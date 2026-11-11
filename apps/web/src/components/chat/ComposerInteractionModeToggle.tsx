import type { ProviderInteractionMode } from "@t3tools/contracts";
import { BotIcon, PencilRulerIcon } from "lucide-react";
import { memo } from "react";

import { MenuRadioGroup, MenuRadioItem, MenuSeparator } from "../ui/menu";
import { Tooltip, TooltipPopup, TooltipTrigger } from "../ui/tooltip";
import { ComposerControl, ComposerControlIcon } from "./ComposerControl";

/** Fork: the Build/Plan toggle upstream removed in 521ac7c218. */
export const ComposerInteractionModeToggle = memo(function ComposerInteractionModeToggle(props: {
  interactionMode: ProviderInteractionMode;
  size: "sm" | "xs";
  onToggle: () => void;
}) {
  const { interactionMode, size } = props;
  const tooltip =
    interactionMode === "plan"
      ? "Plan mode. Click to return to normal build mode"
      : "Default mode. Click to enter plan mode";
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <ComposerControl
            size={size}
            className="shrink-0 whitespace-nowrap"
            aria-pressed={interactionMode === "plan"}
            type="button"
            onClick={props.onToggle}
            aria-label={tooltip}
          />
        }
      >
        {interactionMode === "plan" ? (
          <ComposerControlIcon
            icon={PencilRulerIcon}
            size={size}
            className="text-current opacity-100"
          />
        ) : (
          <ComposerControlIcon
            icon={BotIcon}
            size={size}
            opticalSize={size === "xs" ? "default" : "large"}
          />
        )}
        {/* The compacted row (xs) keeps this icon-only, like the other controls there. */}
        <span
          data-composer-control-label
          className={size === "xs" ? "sr-only" : "sr-only sm:not-sr-only"}
        >
          {interactionMode === "plan" ? "Plan" : "Build"}
        </span>
      </TooltipTrigger>
      <TooltipPopup side="top">{tooltip}</TooltipPopup>
    </Tooltip>
  );
});

/** The same choice inside the composer's overflow menu, for when the toggle is overflowed. */
export function ComposerInteractionModeMenuGroup(props: {
  interactionMode: ProviderInteractionMode;
  separated: boolean;
  onToggle: () => void;
}) {
  return (
    <>
      <div className="px-2 py-1.5 font-medium text-muted-foreground text-xs">Mode</div>
      <MenuRadioGroup
        value={props.interactionMode}
        onValueChange={(value) => {
          if (!value || value === props.interactionMode) return;
          props.onToggle();
        }}
      >
        <MenuRadioItem value="default">Build</MenuRadioItem>
        <MenuRadioItem value="plan">Plan</MenuRadioItem>
      </MenuRadioGroup>
      {props.separated ? <MenuSeparator /> : null}
    </>
  );
}
