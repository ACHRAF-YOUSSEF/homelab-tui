import React, { createContext, useCallback, useContext, useRef } from "react";
import { createTextAttributes, type KeyEvent } from "@opentui/core";
import {
  useKeyboard,
  usePaste,
  useRenderer,
  flushSync,
  type BoxProps as OpenTuiBoxProps,
  type TextProps as OpenTuiTextProps,
} from "@opentui/react";

type BoxProps = Omit<OpenTuiBoxProps, "flexWrap"> & {
  flexWrap?: OpenTuiBoxProps["flexWrap"] | "nowrap";
};

export function Box({ border, borderStyle, flexDirection = "row", flexWrap, ...props }: Readonly<BoxProps>) {
  return (
    <box
      {...props}
      border={border ?? Boolean(borderStyle)}
      borderStyle={borderStyle}
      flexDirection={flexDirection}
      flexWrap={flexWrap === "nowrap" ? "no-wrap" : flexWrap}
    />
  );
}

type TextProps = Omit<OpenTuiTextProps, "fg" | "bg" | "wrapMode" | "truncate"> & {
  color?: string;
  backgroundColor?: string;
  bold?: boolean;
  dimColor?: boolean;
  inverse?: boolean;
  wrap?: "wrap" | "truncate";
};

const NestedText = createContext(false);

export function Text({
  color,
  backgroundColor,
  bold,
  dimColor,
  inverse,
  wrap,
  attributes,
  children,
  ...props
}: Readonly<TextProps>) {
  const nested = useContext(NestedText);
  const foreground = inverse ? backgroundColor ?? "black" : color;
  const background = inverse ? color ?? "white" : backgroundColor;
  const textAttributes = attributes ?? createTextAttributes({ bold, dim: dimColor });
  const content = <NestedText.Provider value>{children}</NestedText.Provider>;

  if (nested) {
    return <span fg={foreground} bg={background} attributes={textAttributes}>{content}</span>;
  }

  return (
    <text
      {...props}
      fg={foreground}
      bg={background}
      attributes={textAttributes}
      wrapMode={wrap === "wrap" ? "word" : "none"}
      truncate={wrap === "truncate"}
    >
      {content}
    </text>
  );
}

type InkKey = {
  upArrow?: boolean;
  downArrow?: boolean;
  return?: boolean;
  escape?: boolean;
  tab?: boolean;
  shift?: boolean;
  pageUp?: boolean;
  pageDown?: boolean;
};

const toInkInput = (key: KeyEvent) =>
  key.sequence.length === 1 ? key.sequence : key.name.length === 1 ? key.name : key.sequence;

const toInkKey = (key: KeyEvent): InkKey => ({
  upArrow: key.name === "up",
  downArrow: key.name === "down",
  return: key.name === "return" || key.name === "enter",
  escape: key.name === "escape",
  tab: key.name === "tab",
  shift: key.shift,
  pageUp: key.name === "pageup",
  pageDown: key.name === "pagedown",
});

export function useInput(
  handler: (input: string, key: InkKey) => void,
  options: { isActive?: boolean } = {},
) {
  useKeyboard((key) => {
    if (options.isActive !== false) {
      flushSync(() => handler(toInkInput(key), toInkKey(key)));
    }
  });
}

export function useApp() {
  const renderer = useRenderer();
  return { exit: useCallback(() => renderer.destroy(), [renderer]) };
}

type TextInputProps = {
  value: string;
  onChange: (value: string) => void;
  onSubmit?: (value: string) => void;
  focus?: boolean;
  mask?: string;
  placeholder?: string;
};

type NativeInputProps = {
  value: string;
  onInput: (value: string) => void;
  onSubmit?: (value: string) => void;
  focused: boolean;
  placeholder?: string;
  flexGrow: number;
};

const NativeInput = (props: NativeInputProps): React.ReactElement =>
  React.createElement("input", props as unknown as React.InputHTMLAttributes<HTMLInputElement>);

const graphemes = (value: string) =>
  Array.from(new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(value), ({ segment }) => segment);

export function TextInput({ value, onChange, onSubmit, focus = false, mask, placeholder }: Readonly<TextInputProps>) {
  const valueRef = useRef(value);
  valueRef.current = value;

  const changeValue = (next: string) => {
    valueRef.current = next;
    onChange(next);
  };

  useKeyboard((key) => {
    if (!focus || !mask) return;
    if (key.name === "return" || key.name === "enter") {
      onSubmit?.(valueRef.current);
      return;
    }
    if (key.name === "backspace") {
      changeValue(graphemes(valueRef.current).slice(0, -1).join(""));
      return;
    }
    if (!key.ctrl && !key.meta && key.sequence && !/[\p{Cc}]/u.test(key.sequence)) {
      changeValue(valueRef.current + key.sequence);
    }
  });

  usePaste((event) => {
    if (focus && mask) {
      const pasted = new TextDecoder().decode(event.bytes).replace(/[\r\n]/g, "");
      changeValue(valueRef.current + pasted);
    }
  });

  if (mask) {
    return <Text>{mask.repeat(graphemes(value).length)}{focus ? "▏" : ""}</Text>;
  }

  return (
    <NativeInput
      value={value}
      onInput={onChange}
      onSubmit={onSubmit}
      focused={focus}
      placeholder={placeholder}
      flexGrow={1}
    />
  );
}
