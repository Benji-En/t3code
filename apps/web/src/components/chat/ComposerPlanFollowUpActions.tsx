import { ChevronDownIcon } from "lucide-react";
import type { PointerEventHandler } from "react";

import { cn } from "~/lib/utils";
import { Menu, MenuItem, MenuPopup, MenuTrigger } from "../ui/menu";
import { composerFloatingLayerProps } from "./composerEventScope";

/** Fork: Refine or Implement a ready plan, upstream removed in 521ac7c218. */
export function ComposerPlanFollowUpActions(props: {
  pillClassName: string;
  compact: boolean;
  promptHasText: boolean;
  disabled: boolean;
  isSendBusy: boolean;
  canOperateThread: boolean;
  preserveComposerFocusOnPointerDown: boolean;
  pointerFocusProps: { onPointerDown: PointerEventHandler<HTMLElement> } | undefined;
  onImplementPlanInNewThread: () => void;
}) {
  const { pillClassName, pointerFocusProps, disabled, isSendBusy } = props;
  if (props.promptHasText) {
    return (
      <button
        type="submit"
        className={cn(pillClassName, "h-9 sm:h-8", props.compact ? "px-3" : "px-4")}
        {...pointerFocusProps}
        disabled={disabled}
      >
        {isSendBusy ? "Sending..." : "Refine"}
      </button>
    );
  }

  return (
    <div data-chat-composer-implement-actions="true" className="flex items-center justify-end">
      <button
        type="submit"
        className={cn(pillClassName, "h-9 rounded-r-none px-4 sm:h-8")}
        {...pointerFocusProps}
        disabled={disabled}
      >
        {isSendBusy ? "Sending..." : "Implement"}
      </button>
      <Menu>
        <MenuTrigger
          render={
            <button
              type="button"
              className={cn(
                pillClassName,
                "h-9 rounded-l-none border-l border-message-action-foreground/20 px-2 sm:h-8",
              )}
              aria-label="Implementation actions"
              onMouseDown={
                props.preserveComposerFocusOnPointerDown
                  ? (event) => event.preventDefault()
                  : undefined
              }
              disabled={disabled}
            />
          }
        >
          <ChevronDownIcon className="size-3.5" />
        </MenuTrigger>
        <MenuPopup align="end" side="top" {...composerFloatingLayerProps}>
          <MenuItem
            disabled={disabled}
            onClick={() => {
              if (props.canOperateThread) props.onImplementPlanInNewThread();
            }}
          >
            Implement in a new thread
          </MenuItem>
        </MenuPopup>
      </Menu>
    </div>
  );
}
