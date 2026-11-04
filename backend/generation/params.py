"""The settings a job runs with, stored as JSON on the job."""

from stamping import NumberFormat, PageRole, Placement, StampConfig


def to_params(config: StampConfig, *, start: int, pad_to_even: bool) -> dict:
    fmt = config.number_format
    return {
        "number_format": {"prefix": fmt.prefix, "digits": fmt.digits, "suffix": fmt.suffix},
        "placements": {
            role.value: (
                {"x": p.x, "y": p.y, "font": p.font_id, "font_size": p.font_size}
                if (p := config.placements.get(role))
                else None
            )
            for role in PageRole
        },
        "start": start,
        "pad_to_even": pad_to_even,
    }


def stamp_config_from_params(params: dict) -> StampConfig:
    fmt = params["number_format"]
    return StampConfig(
        placements={
            PageRole(role): Placement(p["x"], p["y"], p["font"], p["font_size"])
            for role, p in params["placements"].items()
            if p is not None
        },
        number_format=NumberFormat(fmt["prefix"], fmt["digits"], fmt["suffix"]),
    )
