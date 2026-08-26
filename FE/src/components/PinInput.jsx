import { useEffect, useRef, useState } from "react";

export const PIN_LENGTH = 4;

const onlyDigits = (text) => text.replace(/\D/g, "");

const toSlots = (value) =>
  Array.from({ length: PIN_LENGTH }, (_, index) => value[index] ?? "");

// Four single-character boxes that behave like one field: typing advances,
// backspace walks back, and a pasted code fills the whole row.
//
// Slot positions live here rather than in the parent so that clearing a box in
// the middle leaves a hole instead of shifting the digits after it left. The
// parent still receives a plain string, which is short until every box is full.
function PinInput({
  value,
  onChange,
  masked = true,
  autoFocus = false,
  disabled = false,
  label = "PIN",
  onComplete,
}) {
  const boxesRef = useRef([]);
  const [slots, setSlots] = useState(() => toSlots(value));
  const joined = slots.join("");

  // Follow the parent when it sets the value itself - clearing the PIN after a
  // failed attempt, for instance, which also hands the caret back to box one.
  useEffect(() => {
    if (joined === value) return;

    setSlots(toSlots(value));

    if (!value && joined) {
      boxesRef.current[0]?.focus();
    }
  }, [value, joined]);

  const focusBox = (index) => {
    const box = boxesRef.current[Math.min(Math.max(index, 0), PIN_LENGTH - 1)];
    box?.focus();
    box?.select();
  };

  // commit runs on real edits only (typing, pasting, backspace), so every edit
  // that leaves the row full is a deliberate "this is my PIN" - including
  // correcting one digit after a failed attempt.
  const commit = (next) => {
    const nextValue = next.join("");

    setSlots(next);
    onChange(nextValue);

    if (nextValue.length === PIN_LENGTH) {
      // Drop focus so the on-screen keyboard closes as the request goes out.
      boxesRef.current[PIN_LENGTH - 1]?.blur();
      onComplete?.(nextValue);
    }
  };

  const writeFrom = (index, incoming) => {
    const next = slots.slice();
    let cursor = index;

    for (const char of incoming) {
      if (cursor >= PIN_LENGTH) break;
      next[cursor] = char;
      cursor += 1;
    }

    commit(next);

    // A full row has just blurred itself; moving on would take the focus back.
    if (next.join("").length < PIN_LENGTH) {
      focusBox(cursor);
    }
  };

  const handleChange = (index) => (event) => {
    const incoming = onlyDigits(event.target.value);
    if (!incoming) return;
    writeFrom(index, incoming);
  };

  const handleKeyDown = (index) => (event) => {
    if (event.key === "Backspace") {
      event.preventDefault();
      const next = slots.slice();

      if (next[index]) {
        next[index] = "";
        commit(next);
        return;
      }

      next[Math.max(index - 1, 0)] = "";
      commit(next);
      focusBox(index - 1);
      return;
    }

    if (event.key === "ArrowLeft") {
      event.preventDefault();
      focusBox(index - 1);
    }

    if (event.key === "ArrowRight") {
      event.preventDefault();
      focusBox(index + 1);
    }
  };

  const handlePaste = (index) => (event) => {
    const pasted = onlyDigits(event.clipboardData.getData("text"));
    if (!pasted) return;
    event.preventDefault();
    writeFrom(index, pasted);
  };

  return (
    <div
      className="pin-boxes"
      role="group"
      aria-label={`${label}, ${PIN_LENGTH} digits`}
    >
      {slots.map((digit, index) => (
        <input
          key={index}
          ref={(node) => {
            boxesRef.current[index] = node;
          }}
          className={`pin-box${digit ? " filled" : ""}`}
          type={masked ? "password" : "text"}
          inputMode="numeric"
          autoComplete={index === 0 ? "one-time-code" : "off"}
          pattern="\d*"
          maxLength={1}
          value={digit}
          disabled={disabled}
          autoFocus={autoFocus && index === 0}
          aria-label={`${label} digit ${index + 1}`}
          onChange={handleChange(index)}
          onKeyDown={handleKeyDown(index)}
          onPaste={handlePaste(index)}
          onFocus={(event) => event.target.select()}
        />
      ))}
    </div>
  );
}

export default PinInput;
