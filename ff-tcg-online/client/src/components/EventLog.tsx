import React, { useState } from 'react';

interface EventLogProps {
  log: string[];
}

/** Bottom-left, collapsed by default - click to expand and read the recent
 * log, click again (or the header) to collapse. Doesn't stay open on its
 * own; nothing forces it shut either, so leave it open if you want. */
export default function EventLog({ log }: EventLogProps) {
  const [expanded, setExpanded] = useState(false);
  const recent = [...log].slice(-40).reverse();

  return (
    <div className={`event-log-float ${expanded ? 'event-log-expanded' : ''}`}>
      <button className="event-log-header" onClick={() => setExpanded((e) => !e)}>
        Event Log {expanded ? '\u25be' : '\u25b4'}
      </button>
      {expanded && (
        <div className="event-log-body">
          {recent.map((line, i) => (
            <div key={i} className="log-line">
              {line}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}