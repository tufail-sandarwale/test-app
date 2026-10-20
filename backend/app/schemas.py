from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field, SecretStr, model_validator


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid", allow_inf_nan=False, str_strip_whitespace=True)


class Credentials(BaseModel):
    model_config = ConfigDict(extra="forbid")
    email: EmailStr = Field(max_length=254)
    password: SecretStr = Field(min_length=12, max_length=128)


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int


class Coordinate(StrictModel):
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)


class LocationInput(Coordinate):
    name: str = Field(min_length=1, max_length=80)
    accuracy: float = Field(default=5, ge=0.1, le=10000)
    altitude: float = Field(default=0, ge=-12000, le=100000)
    bearing: float = Field(default=0, ge=0, lt=360)
    speed: float = Field(default=0, ge=0, le=300)


class RouteInput(StrictModel):
    name: str = Field(min_length=1, max_length=80)
    points: list[Coordinate] = Field(min_length=2, max_length=500)
    speedKmh: float = Field(gt=0, le=1080)

    @model_validator(mode="after")
    def distinct_points(self):
        if len({(point.latitude, point.longitude) for point in self.points}) < 2:
            raise ValueError("A route requires distinct waypoints.")
        return self


class LocationOutput(LocationInput):
    id: str
    createdAt: datetime
    updatedAt: datetime


class RouteOutput(RouteInput):
    id: str
    createdAt: datetime
    updatedAt: datetime