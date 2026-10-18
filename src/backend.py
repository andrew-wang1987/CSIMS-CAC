# this is the main backend file
# dependencies
from pathlib import Path
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
import numpy as np
import torch
import uvicorn
from pydantic import BaseModel, Field


app = FastAPI(title="CSIMS",description="A mental health web app that utilizes a decision tree algorithm to provide optimized mental health support.", version="1.0")

database = {}


class SimRequest(BaseModel):
    incidents: int = Field(default=100, ge=10, le=10000)
    available_teams: int = Field(default=5, ge=1, le=100)
    policy: str = Field(default="nearest", pattern="^(nearest|balanced)$")
    
FRONTEND_DIR = Path(__file__).resolve().parent.parent / "dist"
@app.get("/", include_in_schema=False)
async def serve_frontend():
    return FileResponse(FRONTEND_DIR / "index.html")
app.mount(
    "/assets",
    StaticFiles(directory=FRONTEND_DIR / "assets"),
    name="assets",
)
 
@app.post("items/{item_id}")
def create_item(item_id: int, item: dict):
    if item_id in database:
        raise HTTPException(status_code=400, detail="Item already exists")
    database[item_id] = item
    return {"message": "Item added successfully", "data": item}

@app.get("items/{item_id}")
def read_item(item_id: int):
    if item_id not in database:
        raise HTTPException(status_code=400, detail="Item not found")
    return database[item_id]

# decision tree endpoint
rng = np.random.default_rng(50)
n_samples = 2000
travel_times = rng.uniform(1, 60, n_samples)
workloads = rng.uniform(0, 1, n_samples)
availability = rng.integers(0, 2, n_samples)

X = torch.tensor(
    np.column_stack([
        travel_times,
        workloads,
        availability
    ]),
    dtype=torch.float32
)

y = torch.tensor(
    (
        (availability == 1) &
        (workloads < 0.8) &
        (travel_times < 35)
    ).astype(np.int64)
)

def build_tree():
    """
    This is a manually defined decision tree through PyTorch. Currently NOT trained on real life data.
    """
    return {
        "feature": 2,       # Availability
        "threshold": 0.5,
        "left": {"value": 0},
        "right": {
            "feature": 1,   # Workload
            "threshold": 0.8,
            "left": {
                "feature": 0,  # Travel time
                "threshold": 35.0,
                "left": {"value": 1},
                "right": {"value": 0}
            },
            "right": {"value": 0}
        }
    }

decision_tree = build_tree()

def predict_tree(tree, features):
    """Predict one example using PyTorch tensors."""
    node = tree

    while "value" not in node:
        feature_index = node["feature"]
        threshold = node["threshold"]

        if features[feature_index].item() <= threshold:
            node = node["left"]
        else:
            node = node["right"]

    return node["value"]

class TeamCandidate(BaseModel):
    travel_time_minutes: float = Field(ge=0, le=300)
    workload: float = Field(ge=0, le=1)
    available: bool

@app.post("/api/evaluate-team")
def evaluate_team(candidate: TeamCandidate):
    features = torch.tensor(
        [
            candidate.travel_time_minutes,
            candidate.workload,
            int(candidate.available)
        ],
        dtype = torch.float32
    )
    prediction = predict_tree(decision_tree, features)
    return {
        "prediction": prediction,
        "model": "pytorch_rule_based_tree",
        "warning": (
            "placeholder"
        )
    }

