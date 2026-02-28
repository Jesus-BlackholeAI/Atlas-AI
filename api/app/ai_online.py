import os
import pickle
from typing import Optional, Tuple

MODEL_PATH = os.getenv("ATLAS_MODEL_PATH", "/app/data/online_model.pkl")

def _ensure_dir():
    d = os.path.dirname(MODEL_PATH)
    if d and not os.path.exists(d):
        os.makedirs(d, exist_ok=True)

def load_model():
    _ensure_dir()
    if os.path.exists(MODEL_PATH):
        with open(MODEL_PATH, "rb") as f:
            return pickle.load(f)
    try:
        from river import compose, feature_extraction, linear_model, optim, preprocessing
        model = compose.Pipeline(
            feature_extraction.BagOfWords(lowercase=True),
            preprocessing.StandardScaler(),
            linear_model.LogisticRegression(optimizer=optim.SGD(0.05))
        )
        return model
    except Exception:
        return None

def save_model(model) -> None:
    if model is None:
        return
    _ensure_dir()
    with open(MODEL_PATH, "wb") as f:
        pickle.dump(model, f)

def learn(model, text: str, label: int):
    if model is None:
        return None
    try:
        model = model.learn_one(text, label)
        save_model(model)
        return model
    except Exception:
        return model

def predict_proba(model, text: str) -> float:
    if model is None:
        # no model -> neutral
        return 0.5
    try:
        proba = model.predict_proba_one(text)
        # river returns dict {class: proba}
        if isinstance(proba, dict):
            return float(proba.get(True, proba.get(1, 0.0)))
        return float(proba)  # fallback
    except Exception:
        return 0.5
