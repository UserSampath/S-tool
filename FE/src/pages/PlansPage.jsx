import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeftIcon,
  CheckIcon,
  ClockIcon,
  FlagIcon,
  GripIcon,
  PlusIcon,
  SortIcon,
  TrashIcon,
} from "../components/icons";
import PriorityMeter from "../components/PriorityMeter";
import { apiFetch } from "../lib/api";
import "./PlansPage.css";

const FILTERS = [
  { id: "all", label: "All" },
  { id: "open", label: "Open" },
  { id: "done", label: "Done" },
];

const HORIZON_KEY = "stools-plans-horizon";

// The two halves of this tool. Each carries the copy that used to belong to its
// own card on the home grid.
const HORIZONS = [
  {
    id: "short",
    label: "This week",
    Icon: ClockIcon,
    sub: "This week's moves, broken down small enough to finish.",
    placeholder: "What needs doing this week?",
    empty: "Add the handful of things that have to happen this week. Small enough to finish.",
  },
  {
    id: "long",
    label: "Long term",
    Icon: FlagIcon,
    sub: "Park the big goals somewhere you will actually revisit them.",
    placeholder: "What are you working towards?",
    empty: "Add the goals worth coming back to. The ones that do not fit in a week.",
  },
];

// Sorting needs "most important first", and an open plan always outranks a
// finished one at the same priority.
const byImportance = (a, b) =>
  Number(a.done) - Number(b.done) || b.priority - a.priority || a.order - b.order;

function PlanRow({
  plan,
  canDrag,
  isDragging,
  dropEdge,
  armed,
  onToggle,
  onPriority,
  onRename,
  onDelete,
  onArm,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
  onHandleKeyDown,
  onGrab,
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(plan.title);
  const inputRef = useRef(null);

  useEffect(() => {
    if (editing) inputRef.current?.select();
  }, [editing]);

  const startEditing = () => {
    setDraft(plan.title);
    setEditing(true);
  };

  const save = () => {
    setEditing(false);
    const next = draft.trim();
    // An empty edit is a slip, not a request to delete; keep what was there.
    if (next && next !== plan.title) onRename(plan, next);
    else setDraft(plan.title);
  };

  return (
    <li
      className="plan-row"
      data-done={plan.done || undefined}
      data-dragging={isDragging || undefined}
      data-drop={dropEdge}
      draggable={canDrag && !editing}
      onDragStart={(event) => onDragStart(event, plan)}
      onDragOver={(event) => onDragOver(event, plan)}
      onDrop={(event) => onDrop(event, plan)}
      onDragEnd={onDragEnd}
    >
      <button
        type="button"
        className="plan-grip"
        aria-label={`Reorder ${plan.title}. Use arrow up and arrow down to move it.`}
        title="Drag to reorder, or focus and use the arrow keys"
        onPointerDown={() => onGrab(true)}
        onPointerUp={() => onGrab(false)}
        onKeyDown={(event) => onHandleKeyDown(event, plan)}
      >
        <GripIcon />
      </button>

      <label className="plan-check">
        <input
          type="checkbox"
          checked={plan.done}
          onChange={(event) => onToggle(plan, event.target.checked)}
        />
        <span className="plan-box" aria-hidden="true">
          <CheckIcon />
        </span>
        <span className="sr-only">Mark {plan.title} as done</span>
      </label>

      {editing ? (
        <input
          ref={inputRef}
          className="plan-title-input"
          value={draft}
          maxLength={200}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={save}
          onKeyDown={(event) => {
            if (event.key === "Enter") save();
            if (event.key === "Escape") {
              setDraft(plan.title);
              setEditing(false);
            }
          }}
        />
      ) : (
        <button type="button" className="plan-title" onClick={startEditing} title="Click to edit">
          {plan.title}
        </button>
      )}

      <PriorityMeter
        value={plan.priority}
        onChange={(next) => onPriority(plan, next)}
        label={`Priority for ${plan.title}`}
      />

      <button
        type="button"
        className="plan-delete"
        data-armed={armed || undefined}
        aria-label={armed ? `Confirm delete ${plan.title}` : `Delete ${plan.title}`}
        onClick={() => (armed ? onDelete(plan) : onArm(plan.id))}
        onBlur={() => armed && onArm(null)}
      >
        {armed ? "Sure?" : <TrashIcon />}
      </button>
    </li>
  );
}

function PlansPage({ tool, token, onBack }) {
  // Short and long term are one tool with two timescales. Which one you were
  // last in is remembered, because most people live in one of them and being
  // dropped into the other every time is a click you should not have to pay.
  const [horizon, setHorizon] = useState(() => {
    try {
      const stored = localStorage.getItem(HORIZON_KEY);
      return HORIZONS.some((entry) => entry.id === stored) ? stored : "short";
    } catch {
      // Private windows and blocked site data both throw here.
      return "short";
    }
  });

  const [plans, setPlans] = useState([]);
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState("all");
  const [title, setTitle] = useState("");
  const [adding, setAdding] = useState(false);
  const [armedId, setArmedId] = useState(null);
  const [dragId, setDragId] = useState(null);
  const [dropTarget, setDropTarget] = useState(null);
  const [announcement, setAnnouncement] = useState("");

  const addRef = useRef(null);
  // Whether the pointer went down on a grip. A ref rather than state because
  // dragstart reads it in the same tick the pointer went down, before any
  // re-render could have landed.
  const grabbedRef = useRef(false);

  const call = useCallback((path, options) => apiFetch(path, { token, ...options }), [token]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setStatus("loading");
      try {
        const data = await call(`/plans?horizon=${horizon}`);
        if (cancelled) return;
        setPlans(data.data);
        setStatus("ready");
      } catch (err) {
        if (cancelled) return;
        setError(err.message);
        setStatus("error");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [call, horizon]);

  const visible = useMemo(() => {
    if (filter === "open") return plans.filter((plan) => !plan.done);
    if (filter === "done") return plans.filter((plan) => plan.done);
    return plans;
  }, [plans, filter]);

  // Copy for whichever timescale is showing.
  const current = HORIZONS.find((entry) => entry.id === horizon) ?? HORIZONS[0];

  const doneCount = plans.filter((plan) => plan.done).length;
  const percent = plans.length ? Math.round((doneCount / plans.length) * 100) : 0;

  // Reordering rewrites every position in the horizon. While a filter hides
  // rows there is no honest answer to "where does this go", so dragging is
  // only offered on the full list.
  const canReorder = filter === "all";

  // Applies a change locally first so the UI never waits on the network. On
  // failure the previous list is restored and the reason is shown.
  const optimistic = async (next, request) => {
    const previous = plans;
    setPlans(next);
    setError(null);

    try {
      await request();
    } catch (err) {
      setPlans(previous);
      setError(err.message);
    }
  };

  const persistOrder = (ordered) =>
    optimistic(ordered, () =>
      call("/plans/reorder", {
        method: "PATCH",
        body: { horizon, ids: ordered.map((plan) => plan.id) },
      }),
    );

  const handleAdd = async (event) => {
    event.preventDefault();
    const value = title.trim();
    if (!value || adding) return;

    setAdding(true);
    setError(null);

    try {
      const data = await call("/plans", { method: "POST", body: { horizon, title: value } });
      setPlans((current) => [...current, data.data]);
      setTitle("");
      // Adding one plan usually means adding several; keep the cursor here.
      addRef.current?.focus();
    } catch (err) {
      setError(err.message);
    } finally {
      setAdding(false);
    }
  };

  const patchPlan = (plan, patch) =>
    optimistic(
      plans.map((entry) => (entry.id === plan.id ? { ...entry, ...patch } : entry)),
      () => call(`/plans/${plan.id}`, { method: "PATCH", body: patch }),
    );

  const handleDelete = (plan) => {
    setArmedId(null);
    optimistic(
      plans.filter((entry) => entry.id !== plan.id),
      () => call(`/plans/${plan.id}`, { method: "DELETE" }),
    );
  };

  const handleClearDone = () =>
    optimistic(
      plans.filter((plan) => !plan.done),
      () => call(`/plans/done?horizon=${horizon}`, { method: "DELETE" }),
    );

  const handleSort = () => {
    const sorted = [...plans].sort(byImportance);
    setAnnouncement("Sorted by priority, highest first.");
    persistOrder(sorted);
  };

  // Shared by drag-and-drop and the keyboard handler.
  const moveTo = (fromIndex, toIndex) => {
    if (toIndex < 0 || toIndex >= plans.length || fromIndex === toIndex) return null;

    const next = [...plans];
    const [moved] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, moved);
    return next;
  };

  const handleDragStart = (event, plan) => {
    // Only the grip starts a drag; dragging the title or the checkbox does not.
    if (!grabbedRef.current) {
      event.preventDefault();
      return;
    }

    setDragId(plan.id);
    event.dataTransfer.effectAllowed = "move";
    // Firefox will not start a drag unless something is on the transfer.
    event.dataTransfer.setData("text/plain", plan.id);
  };

  const handleDragOver = (event, plan) => {
    if (!dragId || plan.id === dragId) return;

    event.preventDefault();
    event.dataTransfer.dropEffect = "move";

    const { top, height } = event.currentTarget.getBoundingClientRect();
    const edge = event.clientY - top < height / 2 ? "above" : "below";

    setDropTarget((current) =>
      current && current.id === plan.id && current.edge === edge ? current : { id: plan.id, edge },
    );
  };

  const handleDrop = (event, plan) => {
    event.preventDefault();
    if (!dragId || plan.id === dragId) return;

    const fromIndex = plans.findIndex((entry) => entry.id === dragId);
    const overIndex = plans.findIndex((entry) => entry.id === plan.id);
    const after = dropTarget?.edge === "below" ? 1 : 0;

    // Pulling the dragged row out first shifts everything below it up by one.
    let toIndex = overIndex + after;
    if (fromIndex < toIndex) toIndex -= 1;

    const next = moveTo(fromIndex, toIndex);
    if (next) persistOrder(next);

    setDragId(null);
    setDropTarget(null);
  };

  const handleDragEnd = () => {
    grabbedRef.current = false;
    setDragId(null);
    setDropTarget(null);
  };

  // Drag-and-drop alone would put reordering out of reach for anyone not using
  // a mouse, so the grip is a real button that moves its row with the arrows.
  const handleHandleKeyDown = (event, plan) => {
    const delta = { ArrowUp: -1, ArrowDown: 1 }[event.key];
    if (delta === undefined) return;

    event.preventDefault();
    if (!canReorder) {
      setAnnouncement("Switch the filter to All to reorder plans.");
      return;
    }

    const fromIndex = plans.findIndex((entry) => entry.id === plan.id);
    const next = moveTo(fromIndex, fromIndex + delta);
    if (!next) return;

    persistOrder(next);
    setAnnouncement(`${plan.title} moved to position ${fromIndex + delta + 1} of ${plans.length}.`);

    // Keep focus travelling with the row it is moving.
    const grip = event.currentTarget;
    requestAnimationFrame(() => grip.focus());
  };

  const switchHorizon = (next) => {
    if (next === horizon) return;

    // Flush any pending edit's error and drop the old list rather than showing
    // one timescale's plans under the other's heading while the fetch runs.
    setPlans([]);
    setError(null);
    setFilter("all");
    setArmedId(null);
    setHorizon(next);

    try {
      localStorage.setItem(HORIZON_KEY, next);
    } catch {
      // Not being able to remember the choice is not worth failing over.
    }
  };

  return (
    <section className="plans" data-accent={tool.accent}>
      <header className="plans-head">
        <button type="button" className="back-link" onClick={onBack}>
          <ArrowLeftIcon />
          All tools
        </button>

        <h1>{tool.name}</h1>
        <p className="plans-sub">{current.sub}</p>

        {/* The two timescales are separate lists, not a filter over one, so
            this switches which list you are looking at entirely. */}
        <div className="plans-horizons" role="tablist" aria-label="Timescale">
          {HORIZONS.map((entry) => (
            <button
              key={entry.id}
              type="button"
              role="tab"
              aria-selected={horizon === entry.id}
              className="plans-horizon"
              data-active={horizon === entry.id || undefined}
              onClick={() => switchHorizon(entry.id)}
            >
              <entry.Icon />
              {entry.label}
            </button>
          ))}
        </div>

        {plans.length > 0 && (
          <div className="plans-progress">
            <div className="plans-bar">
              <span style={{ width: `${percent}%` }} />
            </div>
            <span className="plans-count">
              {doneCount} of {plans.length} done
            </span>
          </div>
        )}
      </header>

      <form className="plan-add" onSubmit={handleAdd}>
        <input
          ref={addRef}
          value={title}
          maxLength={200}
          placeholder={current.placeholder}
          onChange={(event) => setTitle(event.target.value)}
          aria-label="New plan"
        />
        <button type="submit" disabled={!title.trim() || adding}>
          <PlusIcon />
          {adding ? "Adding" : "Add"}
        </button>
      </form>

      {error && (
        <p className="plans-error" role="alert">
          {error}
        </p>
      )}

      {plans.length > 0 && (
        <div className="plans-tools">
          <div className="plans-filters">
            {FILTERS.map((entry) => {
              const count =
                entry.id === "all"
                  ? plans.length
                  : entry.id === "done"
                    ? doneCount
                    : plans.length - doneCount;

              return (
                <button
                  key={entry.id}
                  type="button"
                  className="plans-filter"
                  aria-pressed={filter === entry.id}
                  data-active={filter === entry.id || undefined}
                  onClick={() => setFilter(entry.id)}
                >
                  {entry.label}
                  <span className="plans-pill">{count}</span>
                </button>
              );
            })}
          </div>

          <div className="plans-actions">
            <button type="button" onClick={handleSort} title="Reorder the list by priority">
              <SortIcon />
              Sort by priority
            </button>
            {doneCount > 0 && (
              <button type="button" className="danger" onClick={handleClearDone}>
                <TrashIcon />
                Clear done
              </button>
            )}
          </div>
        </div>
      )}

      {status === "loading" && <p className="plans-note">Loading your plans...</p>}

      {status === "ready" && plans.length === 0 && (
        <div className="plans-empty">
          <p className="plans-empty-title">Nothing here yet</p>
          <p>{current.empty}</p>
        </div>
      )}

      {status === "ready" && plans.length > 0 && visible.length === 0 && (
        <p className="plans-note">
          Nothing matches this filter
          {filter === "done" ? " - nothing is finished yet." : "."}
        </p>
      )}

      {visible.length > 0 && (
        <>
          {!canReorder && (
            <p className="plans-hint">Switch to All to drag plans into a new order.</p>
          )}

          <ul className="plan-list">
            {visible.map((plan) => (
              <PlanRow
                key={plan.id}
                plan={plan}
                canDrag={canReorder}
                isDragging={dragId === plan.id}
                dropEdge={dropTarget?.id === plan.id ? dropTarget.edge : undefined}
                armed={armedId === plan.id}
                onToggle={(entry, done) => patchPlan(entry, { done })}
                onPriority={(entry, priority) => patchPlan(entry, { priority })}
                onRename={(entry, next) => patchPlan(entry, { title: next })}
                onDelete={handleDelete}
                onArm={setArmedId}
                onGrab={(value) => {
                  grabbedRef.current = value;
                }}
                onDragStart={handleDragStart}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                onDragEnd={handleDragEnd}
                onHandleKeyDown={handleHandleKeyDown}
              />
            ))}
          </ul>
        </>
      )}

      <p className="sr-only" role="status" aria-live="polite">
        {announcement}
      </p>
    </section>
  );
}

export default PlansPage;
