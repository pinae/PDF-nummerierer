import Box from "@mui/material/Box";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";

import type { PageRole, Placements } from "../api/types";
import { firstPageOfRole } from "../pdf/pages";
import { strings } from "../strings";
import { ROLES } from "./state";

const text = strings.placement;

export interface RoleSelectorProps {
  active: PageRole;
  pageCount: number;
  placements: Placements;
  onSelect: (role: PageRole) => void;
}

/** First page | Odd pages | Even pages — which pages are being edited. */
export function RoleSelector({ active, pageCount, placements, onSelect }: RoleSelectorProps) {
  return (
    <Box sx={{ px: { xs: 1, sm: 2 }, pt: 1 }}>
      <ToggleButtonGroup
        exclusive
        size="small"
        color="primary"
        value={active}
        onChange={(_, role: PageRole | null) => role && onSelect(role)}
        aria-label={text.rolesLabel}
        sx={{
          width: { xs: "100%", sm: "auto" },
          "& .MuiToggleButton-root": { flex: { xs: 1, sm: "none" } },
        }}
      >
        {ROLES.map((role) => (
          <ToggleButton
            key={role}
            value={role}
            disabled={firstPageOfRole(role, pageCount) === null}
            sx={{ textTransform: "none", px: 2 }}
          >
            {text.roles[role]}
            {placements[role] === null && (
              <Box component="span" sx={{ ml: 0.75, fontSize: "0.75em", opacity: 0.7 }}>
                {text.off}
              </Box>
            )}
          </ToggleButton>
        ))}
      </ToggleButtonGroup>
    </Box>
  );
}
