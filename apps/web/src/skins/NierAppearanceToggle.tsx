import { MoonIcon, SunIcon } from "lucide-react";

import { useTheme } from "../hooks/useTheme";
import { SidebarMenuButton, SidebarMenuItem } from "../components/ui/sidebar";
import { stackedThreadToast, toastManager } from "../components/ui/toast";
import { Tooltip, TooltipPopup, TooltipTrigger } from "../components/ui/tooltip";

export function NierAppearanceToggle() {
  const { theme, resolvedTheme, setAppearanceMode } = useTheme();
  if (theme !== "benji-nier-archive") return null;

  const dark = resolvedTheme === "dark";
  const label = dark ? "Switch to light mode" : "Switch to dark mode";
  const Icon = dark ? SunIcon : MoonIcon;
  return (
    <SidebarMenuItem className="shrink-0">
      <Tooltip>
        <TooltipTrigger
          render={
            <SidebarMenuButton
              aria-label="Toggle dark mode"
              aria-pressed={dark}
              size="icon"
              onClick={() => {
                if (!setAppearanceMode(dark ? "light" : "dark")) {
                  toastManager.add(
                    stackedThreadToast({
                      type: "error",
                      title: "Couldn't save appearance",
                      description: "Try again.",
                    }),
                  );
                }
              }}
            >
              <Icon />
            </SidebarMenuButton>
          }
        />
        <TooltipPopup side="top">{label}</TooltipPopup>
      </Tooltip>
    </SidebarMenuItem>
  );
}
