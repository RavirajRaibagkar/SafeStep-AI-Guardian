"""
F11: TFLite Distress Audio Classifier Training Script
Trains a MobileNet-based audio classifier on mel-spectrogram features.
Classes: SCREAM, CRY, NORMAL, PANIC, HELP_CALL

Run: python train.py
Output: distress_model.tflite
"""
import os
import numpy as np
import tensorflow as tf
from tensorflow import keras
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

CLASSES = ['NORMAL', 'SCREAM', 'CRY', 'PANIC', 'HELP_CALL']
NUM_CLASSES = len(CLASSES)
SAMPLE_RATE = 16000
AUDIO_DURATION = 2  # seconds per window
N_MELS = 64
N_FFT = 512
HOP_LENGTH = 256
INPUT_SHAPE = (N_MELS, 63, 1)  # mel-spectrogram shape


def generate_synthetic_training_data(samples_per_class=200):
    """
    Generate realistic synthetic training samples using audio feature simulation.
    In production: replace with real labeled audio datasets (e.g., ESC-50, UrbanSound8K).
    """
    X = []
    y = []

    rng = np.random.RandomState(42)

    for class_idx, class_name in enumerate(CLASSES):
        for _ in range(samples_per_class):
            # Simulate different mel-spectrogram patterns per class
            spec = np.zeros((N_MELS, 63))

            if class_name == 'NORMAL':
                # Ambient noise: low energy, distributed
                spec = rng.normal(0.1, 0.05, (N_MELS, 63))
                spec = np.clip(spec, 0, 1)

            elif class_name == 'SCREAM':
                # High energy burst across frequencies, especially mids
                burst_start = rng.randint(20, 50)
                spec[burst_start:burst_start + 20, 10:50] = rng.uniform(0.7, 1.0, (20, 40))
                spec += rng.normal(0.1, 0.02, (N_MELS, 63))

            elif class_name == 'CRY':
                # Rhythmic pattern with high-frequency components
                for t in range(0, 63, 5):
                    spec[30:50, t:t + 2] = rng.uniform(0.5, 0.8, (20, 2))
                spec += rng.normal(0.05, 0.02, (N_MELS, 63))

            elif class_name == 'PANIC':
                # High energy, rapid variations
                spec = rng.uniform(0.4, 0.9, (N_MELS, 63))
                spec[0:20, :] *= 0.3  # less low-frequency
                spec += rng.normal(0, 0.05, (N_MELS, 63))

            elif class_name == 'HELP_CALL':
                # Short high-energy bursts with speech-like pattern
                for t in [10, 25, 40, 55]:
                    spec[20:45, t:t + 4] = rng.uniform(0.6, 0.9, (25, 4))
                spec += rng.normal(0.05, 0.02, (N_MELS, 63))

            spec = np.clip(spec, 0, 1)
            spec = spec[..., np.newaxis]  # add channel dim
            X.append(spec)
            y.append(class_idx)

    X = np.array(X, dtype=np.float32)
    y = np.array(y, dtype=np.int32)

    # Shuffle
    idx = rng.permutation(len(X))
    return X[idx], y[idx]


def build_model():
    """Build lightweight CNN for on-device inference (<200ms on mid-range Android)."""
    model = keras.Sequential([
        keras.layers.Input(shape=INPUT_SHAPE),

        keras.layers.Conv2D(32, (3, 3), activation='relu', padding='same'),
        keras.layers.BatchNormalization(),
        keras.layers.MaxPooling2D((2, 2)),
        keras.layers.Dropout(0.25),

        keras.layers.Conv2D(64, (3, 3), activation='relu', padding='same'),
        keras.layers.BatchNormalization(),
        keras.layers.MaxPooling2D((2, 2)),
        keras.layers.Dropout(0.25),

        keras.layers.Conv2D(128, (3, 3), activation='relu', padding='same'),
        keras.layers.BatchNormalization(),
        keras.layers.GlobalAveragePooling2D(),
        keras.layers.Dropout(0.4),

        keras.layers.Dense(128, activation='relu'),
        keras.layers.Dropout(0.3),
        keras.layers.Dense(NUM_CLASSES, activation='softmax'),
    ])

    model.compile(
        optimizer=keras.optimizers.Adam(learning_rate=0.001),
        loss='sparse_categorical_crossentropy',
        metrics=['accuracy']
    )
    return model


def train():
    logger.info("Generating synthetic training data...")
    X, y = generate_synthetic_training_data(samples_per_class=300)

    split = int(0.8 * len(X))
    X_train, X_val = X[:split], X[split:]
    y_train, y_val = y[:split], y[split:]

    logger.info(f"Training samples: {len(X_train)}, Validation: {len(X_val)}")
    logger.info(f"Input shape: {INPUT_SHAPE}, Classes: {CLASSES}")

    model = build_model()
    model.summary()

    callbacks = [
        keras.callbacks.EarlyStopping(patience=10, restore_best_weights=True),
        keras.callbacks.ReduceLROnPlateau(factor=0.5, patience=5),
    ]

    history = model.fit(
        X_train, y_train,
        validation_data=(X_val, y_val),
        epochs=50,
        batch_size=32,
        callbacks=callbacks,
        verbose=1,
    )

    val_accuracy = max(history.history['val_accuracy'])
    logger.info(f"Best validation accuracy: {val_accuracy:.4f}")

    # Convert to TFLite
    converter = tf.lite.TFLiteConverter.from_keras_model(model)
    converter.optimizations = [tf.lite.Optimize.DEFAULT]
    converter.target_spec.supported_types = [tf.float16]
    tflite_model = converter.convert()

    output_path = 'distress_model.tflite'
    with open(output_path, 'wb') as f:
        f.write(tflite_model)

    logger.info(f"TFLite model saved: {output_path} ({len(tflite_model) / 1024:.1f} KB)")

    # Save class labels
    with open('distress_labels.txt', 'w') as f:
        for cls in CLASSES:
            f.write(cls + '\n')

    return output_path


def load_and_infer(audio_features: np.ndarray, model_path='distress_model.tflite') -> dict:
    """Run inference on 2-second audio window. Returns classification + confidence."""
    interpreter = tf.lite.Interpreter(model_path=model_path)
    interpreter.allocate_tensors()

    input_details = interpreter.get_input_details()
    output_details = interpreter.get_output_details()

    # Ensure shape matches
    features = audio_features.astype(np.float32)
    if features.shape != (1, N_MELS, 63, 1):
        features = features.reshape(1, N_MELS, 63, 1)

    interpreter.set_tensor(input_details[0]['index'], features)
    interpreter.invoke()

    output = interpreter.get_tensor(output_details[0]['index'])[0]
    predicted_class = CLASSES[np.argmax(output)]
    confidence = float(np.max(output))

    return {
        'classification': predicted_class,
        'confidence': confidence,
        'is_distress': predicted_class in ['SCREAM', 'CRY', 'PANIC', 'HELP_CALL'] and confidence > 0.85,
        'scores': {cls: float(output[i]) for i, cls in enumerate(CLASSES)},
    }


if __name__ == '__main__':
    train()
