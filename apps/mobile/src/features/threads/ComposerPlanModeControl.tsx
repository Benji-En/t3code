import type { ProviderInteractionMode } from "@t3tools/contracts";

import { ComposerInlineControl } from "../../components/ComposerToolbar";

/** Fork: names plan mode in the composer; a tap returns to build mode. `/plan` enters it. */
export function ComposerPlanModeControl(props: {
  readonly interactionMode: ProviderInteractionMode | null | undefined;
  readonly size: "regular" | "large";
  readonly iconOnly: boolean;
  readonly onUpdateInteractionMode: ((mode: ProviderInteractionMode) => void) | undefined;
}) {
  const update = props.onUpdateInteractionMode;
  if (props.interactionMode !== "plan" || !update) return null;
  return (
    <ComposerInlineControl
      size={props.size}
      icon="list.number"
      label="Plan"
      accessibilityLabel="Plan mode"
      accessibilityHint="Returns to build mode"
      emphasized
      selected
      iconOnly={props.iconOnly}
      showChevron={false}
      onPress={() => update("default")}
    />
  );
}
