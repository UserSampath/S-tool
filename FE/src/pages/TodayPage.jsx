import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeftIcon,
  BacklogIcon,
  CalendarIcon,
  ChevronIcon,
  GripIcon,
  PlusIcon,
  StatusIcon,
  TrashIcon,
} from "../components/icons";
import {
  WEEKDAYS,
  addMonths,
  dayLabel,
  fullLabel,
  isToday,
  monthGrid,
  monthLabel,
  monthRange,
  todayKey,
} from "../lib/dates";
import { apiFetch } from "../lib/api";
import "../styles/tool.css";
import "./TodayPage.css";

// Clicking a task's status walks it forward through the three states.
const NEXT = { todo: "doing", doing: "done", done: "todo" };
const STATUS_LABEL = { todo: "To do", doing: "In progress", done: "Done" };

// An inline title editor, shared by both lists.
function TaskTitle({ task, editing, setEditing, onRename }) {
  const [draft, setDraft] = useState(task.title);
  const inputRef = useRef(null);

  useEffect(() => {
    if (editing) inputRef.current?.select();
  }, [editing]);

  const save = () => {
    setEditing(false);
    const next = draft.trim();
    // An empty edit is a slip, not a request to delete; keep what was there.
    if (next && next !== task.title) onRename(task, next);
    else setDraft(task.title);
  };

  if (editing) {
    return (
      <input
        ref={inputRef}
        className="day-task-input"
        value={draft}
        maxLength={200}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={save}
        onKeyDown={(event) => {
          if (event.key === "Enter") save();
          if (event.key === "Escape") {
            setDraft(task.title);
            setEditing(false);
          }
        }}
      />
    );
  }

  return (
    <button
      type="button"
      className="day-task-title"
      title="Click to edit"
      onClick={() => {
        setDraft(task.title);
        setEditing(true);
      }}
    >
      {task.title}
    </button>
  );
}

// The arm-to-confirm delete, shared by both lists.
function DeleteButton({ task, onDelete }) {
  const [armed, setArmed] = useState(false);

  return (
    <button
      type="button"
      className="day-delete"
      data-armed={armed || undefined}
      aria-label={armed ? `Confirm delete ${task.title}` : `Delete ${task.title}`}
      onClick={() => (armed ? onDelete(task) : setArmed(true))}
      onBlur={() => setArmed(false)}
    >
      {armed ? "Sure?" : <TrashIcon />}
    </button>
  );
}

function DayRow({ task, dragging, dropBefore, drag, onStatus, onRename, onDelete, onSend }) {
  const [editing, setEditing] = useState(false);

  return (
    <li
      className="day-task"
      data-status={task.status}
      data-dragging={dragging || undefined}
      data-drop-before={dropBefore || undefined}
      draggable={!editing}
      onDragStart={drag.start(task, "day")}
      onDragEnd={drag.end}
      onDragOver={drag.overRow("day", task)}
      onDrop={drag.drop("day")}
    >
      <span className="day-grip" aria-hidden="true">
        <GripIcon />
      </span>

      <button
        type="button"
        className="day-status"
        title={`${STATUS_LABEL[task.status]} - click for ${STATUS_LABEL[NEXT[task.status]]}`}
        aria-label={`${task.title}: ${STATUS_LABEL[task.status]}. Change to ${STATUS_LABEL[NEXT[task.status]]}.`}
        onClick={() => onStatus(task, NEXT[task.status])}
      >
        <StatusIcon status={task.status} />
      </button>

      <TaskTitle task={task} editing={editing} setEditing={setEditing} onRename={onRename} />

      <span className="day-task-tag">{STATUS_LABEL[task.status]}</span>

      {/*
        Only an unstarted task can go back. The button is simply absent on the
        others, which teaches the rule without ever having to refuse a click.
      */}
      {task.status === "todo" && (
        <button
          type="button"
          className="day-send"
          title="Move to the backlog"
          aria-label={`Move ${task.title} to the backlog`}
          onClick={() => onSend(task)}
        >
          <BacklogIcon />
        </button>
      )}

      <DeleteButton task={task} onDelete={onDelete} />
    </li>
  );
}

function BacklogRow({ task, dayName, dragging, dropBefore, drag, onRename, onDelete, onSend }) {
  const [editing, setEditing] = useState(false);

  return (
    <li
      className="day-task backlog-task"
      data-dragging={dragging || undefined}
      data-drop-before={dropBefore || undefined}
      draggable={!editing}
      onDragStart={drag.start(task, "backlog")}
      onDragEnd={drag.end}
      onDragOver={drag.overRow("backlog", task)}
      onDrop={drag.drop("backlog")}
    >
      <span className="day-grip" aria-hidden="true">
        <GripIcon />
      </span>

      <TaskTitle task={task} editing={editing} setEditing={setEditing} onRename={onRename} />

      <button
        type="button"
        className="day-send"
        title={`Add to ${dayName}`}
        aria-label={`Add ${task.title} to ${dayName}`}
        onClick={() => onSend(task)}
      >
        <CalendarIcon />
      </button>

      <DeleteButton task={task} onDelete={onDelete} />
    </li>
  );
}

function TodayPage({ tool, token, onBack }) {
  const [selected, setSelected] = useState(() => todayKey());
  const [month, setMonth] = useState(() => todayKey());

  const [tasks, setTasks] = useState([]);
  const [backlog, setBacklog] = useState([]);
  const [summary, setSummary] = useState({});
  const [status, setStatus] = useState("loading");
  const [title, setTitle] = useState("");
  const [backlogTitle, setBacklogTitle] = useState("");
  const [adding, setAdding] = useState(null);
  const [error, setError] = useState(null);

  const addRef = useRef(null);
  const backlogRef = useRef(null);

  // Drag state lives in a ref and in state at once: the drop handler has to read
  // it synchronously, while the rows need a re-render to show what is moving.
  const dragRef = useRef(null);
  const dropRef = useRef(null);
  const [dragging, setDragging] = useState(null);
  const [drop, setDrop] = useState(null);

  const call = useCallback((path, options) => apiFetch(path, { token, ...options }), [token]);

  // Indicators are keyed by day so a cell can look itself up without scanning.
  const loadSummary = useCallback(
    async (monthKey) => {
      const { from, to } = monthRange(monthKey);

      try {
        const data = await call(`/day-tasks/summary?from=${from}&to=${to}`);
        setSummary(Object.fromEntries(data.data.map((row) => [row.date, row])));
      } catch (err) {
        setError(err.message);
      }
    },
    [call],
  );

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setStatus("loading");
      try {
        const data = await call(`/day-tasks?date=${selected}`);
        if (cancelled) return;
        setTasks(data.data);
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
  }, [call, selected]);

  // The backlog belongs to no day, so it is loaded once and not per selection.
  const loadBacklog = useCallback(async () => {
    try {
      const data = await call("/day-tasks/backlog");
      setBacklog(data.data);
    } catch (err) {
      setError(err.message);
    }
  }, [call]);

  useEffect(() => {
    loadBacklog();
  }, [loadBacklog]);

  useEffect(() => {
    loadSummary(month);
  }, [loadSummary, month]);

  const weeks = useMemo(() => monthGrid(month), [month]);

  const counts = useMemo(() => {
    const base = { todo: 0, doing: 0, done: 0 };
    for (const task of tasks) base[task.status] += 1;
    return base;
  }, [tasks]);

  const relative = dayLabel(selected);
  const full = fullLabel(selected);
  const dayName = relative.toLowerCase();

  // A mutation changes both the open day and its dot on the calendar.
  const afterChange = () => loadSummary(month);

  const optimistic = async (next, request) => {
    const previous = tasks;
    setTasks(next);
    setError(null);

    try {
      await request();
      afterChange();
    } catch (err) {
      setTasks(previous);
      setError(err.message);
    }
  };

  const add = async (event, date) => {
    event.preventDefault();
    const toDay = date !== null;
    const value = (toDay ? title : backlogTitle).trim();
    if (!value || adding) return;

    setAdding(toDay ? "day" : "backlog");
    setError(null);

    try {
      const data = await call("/day-tasks", { method: "POST", body: { date, title: value } });

      if (toDay) {
        setTasks((current) => [...current, data.data]);
        setTitle("");
        // Tasks go in one by one, so the cursor stays put for the next one.
        addRef.current?.focus();
        afterChange();
      } else {
        setBacklog((current) => [...current, data.data]);
        setBacklogTitle("");
        backlogRef.current?.focus();
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setAdding(null);
    }
  };

  const setStatusOf = (task, next) =>
    optimistic(
      tasks.map((entry) => (entry.id === task.id ? { ...entry, status: next } : entry)),
      () => call(`/day-tasks/${task.id}`, { method: "PATCH", body: { status: next } }),
    );

  const renameIn = (list) => (task, next) => {
    const setList = list === "day" ? setTasks : setBacklog;
    const previous = list === "day" ? tasks : backlog;

    setList(previous.map((entry) => (entry.id === task.id ? { ...entry, title: next } : entry)));
    setError(null);

    call(`/day-tasks/${task.id}`, { method: "PATCH", body: { title: next } }).catch((err) => {
      setList(previous);
      setError(err.message);
    });
  };

  const removeIn = (list) => (task) => {
    const setList = list === "day" ? setTasks : setBacklog;
    const previous = list === "day" ? tasks : backlog;

    setList(previous.filter((entry) => entry.id !== task.id));
    setError(null);

    call(`/day-tasks/${task.id}`, { method: "DELETE" })
      .then(() => {
        if (list === "day") afterChange();
      })
      .catch((err) => {
        setList(previous);
        setError(err.message);
      });
  };

  /**
   * The one path every move takes, whether it came from a drag or a button.
   *
   * `beforeId` is the row the task should land above, or null for the end of the
   * list. It is turned into an index against the destination *with the moved
   * task taken out*, because that is what the server splices into - and because
   * a row dropped on itself then resolves to -1, which is the honest answer.
   */
  const applyMove = async (info, list, beforeId) => {
    const toDay = list === "day";
    const source = info.from === "day" ? tasks : backlog;
    const task = source.find((entry) => entry.id === info.id);
    if (!task) return;

    if (!toDay && task.status !== "todo") return;

    const dest = (toDay ? tasks : backlog).filter((entry) => entry.id !== info.id);
    const index =
      beforeId === null || beforeId === undefined
        ? dest.length
        : dest.findIndex((entry) => entry.id === beforeId);

    // Dropped on itself, or onto a row that has already gone: nothing to do.
    if (index === -1) return;

    const previousTasks = tasks;
    const previousBacklog = backlog;

    const moved = { ...task, date: toDay ? selected : null };
    const next = [...dest.slice(0, index), moved, ...dest.slice(index)];

    (toDay ? setTasks : setBacklog)(next);
    if (info.from !== list) {
      (toDay ? setBacklog : setTasks)((current) =>
        current.filter((entry) => entry.id !== info.id),
      );
    }
    setError(null);

    try {
      await call(`/day-tasks/${info.id}/move`, {
        method: "PATCH",
        body: { date: toDay ? selected : null, index },
      });
      afterChange();
    } catch (err) {
      setTasks(previousTasks);
      setBacklog(previousBacklog);
      setError(err.message);
    }
  };

  const setDropTarget = (value) => {
    dropRef.current = value;
    setDrop(value);
  };

  const endDrag = () => {
    dragRef.current = null;
    dropRef.current = null;
    setDragging(null);
    setDrop(null);
  };

  const drag = {
    start: (task, from) => (event) => {
      const info = { id: task.id, from, status: task.status };
      dragRef.current = info;
      setDragging(info);
      event.dataTransfer.effectAllowed = "move";
      // Some browsers refuse to start a drag with no payload; the ref carries
      // the real one, since dataTransfer cannot be read during dragover.
      event.dataTransfer.setData("text/plain", task.id);
    },

    end: endDrag,

    overRow: (list, task) => (event) => {
      const info = dragRef.current;
      if (!info) return;

      event.preventDefault();
      event.stopPropagation();

      if (list === "backlog" && info.status !== "todo") {
        event.dataTransfer.dropEffect = "none";
        setDropTarget({ list, blocked: true });
        return;
      }

      event.dataTransfer.dropEffect = "move";

      const items = list === "day" ? tasks : backlog;
      const at = items.findIndex((entry) => entry.id === task.id);
      const box = event.currentTarget.getBoundingClientRect();
      const below = event.clientY > box.top + box.height / 2;

      setDropTarget({
        list,
        beforeId: below ? (items[at + 1]?.id ?? null) : task.id,
      });
    },

    // The area around the rows: everything here means "put it at the end".
    overList: (list) => (event) => {
      const info = dragRef.current;
      if (!info) return;

      event.preventDefault();

      if (list === "backlog" && info.status !== "todo") {
        event.dataTransfer.dropEffect = "none";
        setDropTarget({ list, blocked: true });
        return;
      }

      event.dataTransfer.dropEffect = "move";
      setDropTarget({ list, beforeId: null });
    },

    drop: (list) => (event) => {
      event.preventDefault();
      event.stopPropagation();

      const info = dragRef.current;
      const target = dropRef.current;
      endDrag();

      if (!info || !target || target.list !== list || target.blocked) return;
      applyMove(info, list, target.beforeId);
    },
  };

  // The button beside each row: the same move, aimed at the other list.
  const send = (from) => (task) =>
    applyMove({ id: task.id, from, status: task.status }, from === "day" ? "backlog" : "day", null);

  const dropLineFor = (list) => (drop && drop.list === list && !drop.blocked ? drop.beforeId : undefined);

  const pickDay = (key) => {
    setSelected(key);
    // Clicking a greyed-out neighbour day should bring its month into view.
    if (key.slice(0, 7) !== month.slice(0, 7)) setMonth(key);
  };

  const goToday = () => {
    const key = todayKey();
    setSelected(key);
    setMonth(key);
  };

  const dayDrop = dropLineFor("day");
  const backlogDrop = dropLineFor("backlog");

  return (
    <section className="tool today" data-accent={tool.accent}>
      <header className="tool-head">
        <button type="button" className="back-link" onClick={onBack}>
          <ArrowLeftIcon />
          All tools
        </button>

        <h1>{tool.name}</h1>
        <p className="tool-sub">{tool.description}</p>
      </header>

      {error && (
        <p className="alert" role="alert">
          {error}
        </p>
      )}

      <div className="today-layout">
        <aside className="card today-calendar">
          <div className="card-head">
            <button
              type="button"
              className="cal-nav"
              aria-label="Previous month"
              onClick={() => setMonth(addMonths(month, -1))}
            >
              <ChevronIcon />
            </button>

            <h2 className="cal-month">{monthLabel(month)}</h2>

            <button
              type="button"
              className="cal-nav"
              aria-label="Next month"
              onClick={() => setMonth(addMonths(month, 1))}
            >
              <ChevronIcon />
            </button>
          </div>

          <div className="card-body">
            <div className="cal-weekdays" aria-hidden="true">
              {WEEKDAYS.map((day) => (
                <span key={day}>{day}</span>
              ))}
            </div>

            <div className="cal-grid" role="grid">
              {weeks.flat().map((cell) => {
                const day = summary[cell.key];
                const complete = day && day.done === day.total;

                return (
                  <button
                    key={cell.key}
                    type="button"
                    className="cal-day"
                    role="gridcell"
                    data-outside={!cell.inMonth || undefined}
                    data-today={isToday(cell.key) || undefined}
                    data-selected={cell.key === selected || undefined}
                    aria-current={isToday(cell.key) ? "date" : undefined}
                    aria-label={`${fullLabel(cell.key)}${day ? `, ${day.total} task${day.total === 1 ? "" : "s"}, ${day.done} done` : ", no tasks"}`}
                    onClick={() => pickDay(cell.key)}
                  >
                    <span className="cal-num">{cell.day}</span>

                    {/*
                      The indicator is a proportion bar, not a count: at this
                      size the useful question is "how much of that day is
                      left", which a three-part bar answers without reading.
                    */}
                    {day && (
                      <span className="cal-bar" data-complete={complete || undefined}>
                        <i className="is-done" style={{ flexGrow: day.done }} />
                        <i className="is-doing" style={{ flexGrow: day.doing }} />
                        <i className="is-todo" style={{ flexGrow: day.todo }} />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            <button type="button" className="btn btn-quiet cal-today" onClick={goToday}>
              Jump to today
            </button>
          </div>
        </aside>

        <div
          className="card today-day"
          data-drop-into={drop?.list === "day" || undefined}
          onDragOver={drag.overList("day")}
          onDrop={drag.drop("day")}
        >
          <div className="card-head">
            <div className="today-title">
              <h2>{relative}</h2>
              {/* The relative label is friendlier; the full date keeps it
                  unambiguous once you are three weeks back. */}
              {relative !== full && <span className="meta">{full}</span>}
            </div>

            {tasks.length > 0 && (
              <span className="meta today-counts">
                {counts.done} done · {counts.doing} in progress · {counts.todo} to do
              </span>
            )}
          </div>

          <form className="today-add" onSubmit={(event) => add(event, selected)}>
            <input
              ref={addRef}
              className="field"
              value={title}
              maxLength={200}
              placeholder={isToday(selected) ? "What needs doing today?" : `Add a task for ${dayName}`}
              aria-label="New task"
              onChange={(event) => setTitle(event.target.value)}
            />
            <button
              type="submit"
              className="btn btn-primary"
              disabled={!title.trim() || adding !== null}
            >
              <PlusIcon />
              {adding === "day" ? "Adding" : "Add"}
            </button>
          </form>

          {status === "loading" && <p className="meta today-note">Loading...</p>}

          {status === "ready" && tasks.length === 0 && (
            <p className="meta today-note">
              Nothing planned for {dayName}. Add a task above, or drag one over from the backlog.
            </p>
          )}

          <ul className="day-list" data-drop-end={dayDrop === null || undefined}>
            {tasks.map((task) => (
              <DayRow
                key={task.id}
                task={task}
                dragging={dragging?.id === task.id}
                dropBefore={dayDrop === task.id}
                drag={drag}
                onStatus={setStatusOf}
                onRename={renameIn("day")}
                onDelete={removeIn("day")}
                onSend={send("day")}
              />
            ))}
          </ul>
        </div>

        <aside
          className="card today-backlog"
          data-drop-into={drop?.list === "backlog" || undefined}
          data-drop-blocked={(drop?.list === "backlog" && drop.blocked) || undefined}
          onDragOver={drag.overList("backlog")}
          onDrop={drag.drop("backlog")}
        >
          <div className="card-head">
            <span className="backlog-chip" aria-hidden="true">
              <BacklogIcon />
            </span>

            <div className="today-title">
              <h2>Backlog</h2>
              <span className="meta">Work with no day yet</span>
            </div>

            {backlog.length > 0 && <span className="meta today-counts">{backlog.length}</span>}
          </div>

          <form className="today-add" onSubmit={(event) => add(event, null)}>
            <input
              ref={backlogRef}
              className="field"
              value={backlogTitle}
              maxLength={200}
              placeholder="Something for later"
              aria-label="New backlog task"
              onChange={(event) => setBacklogTitle(event.target.value)}
            />
            <button
              type="submit"
              className="btn btn-quiet"
              disabled={!backlogTitle.trim() || adding !== null}
              aria-label="Add to backlog"
            >
              <PlusIcon />
            </button>
          </form>

          {backlog.length === 0 && (
            <p className="meta today-note">
              Empty. Park anything here that is worth doing but not worth promising to a day.
            </p>
          )}

          <ul className="day-list" data-drop-end={backlogDrop === null || undefined}>
            {backlog.map((task) => (
              <BacklogRow
                key={task.id}
                task={task}
                dayName={dayName}
                dragging={dragging?.id === task.id}
                dropBefore={backlogDrop === task.id}
                drag={drag}
                onRename={renameIn("backlog")}
                onDelete={removeIn("backlog")}
                onSend={send("backlog")}
              />
            ))}
          </ul>

          {/* Says why the drop is being refused, at the moment it is refused. */}
          {drop?.list === "backlog" && drop.blocked && (
            <p className="meta today-note backlog-refuse">
              Only a to-do task can come back here.
            </p>
          )}
        </aside>
      </div>
    </section>
  );
}

export default TodayPage;
