import React, { useState } from "react";
import { ChevronRight, ChevronDown } from "lucide-react";
import { cn } from "../../lib/utils";

const highlightValue = (value: any) => {
  if (typeof value === "string") {
    return <span className="text-emerald-400 break-all">"{value}"</span>;
  }
  if (typeof value === "number") {
    return <span className="text-amber-400">{value}</span>;
  }
  if (typeof value === "boolean") {
    return <span className="text-purple-400 font-bold">{value ? "true" : "false"}</span>;
  }
  if (value === null) {
    return <span className="text-slate-500 italic">null</span>;
  }
  return <span>{String(value)}</span>;
};

const JsonNode = ({ label, value, isLast, depth = 0 }: any) => {
  const [expanded, setExpanded] = useState(depth < 2);
  const isObject = value !== null && typeof value === "object";
  const isArray = Array.isArray(value);

  if (!isObject) {
    return (
      <div className="flex font-mono text-[13px] hover:bg-slate-800/30 px-1 py-0.5 rounded leading-relaxed">
        <span className="w-4 shrink-0 inline-block"></span>
        {label && <span className="text-sky-400 font-semibold mr-1">"{label}":</span>}
        {highlightValue(value)}
        {!isLast && <span className="text-slate-500">,</span>}
      </div>
    );
  }

  const isEmpty = Object.keys(value).length === 0;
  const startBrace = isArray ? "[" : "{";
  const endBrace = isArray ? "]" : "}";

  return (
    <div className="font-mono text-[13px] leading-relaxed">
      <div
        className="flex cursor-pointer hover:bg-slate-800/30 px-1 py-0.5 rounded select-none items-center"
        onClick={() => setExpanded(!expanded)}
      >
        <span className="w-4 shrink-0 inline-flex items-center justify-center text-slate-500 hover:text-slate-300">
          {!isEmpty && (expanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />)}
        </span>
        {label && <span className="text-sky-400 font-semibold mr-1">"{label}":</span>}
        <span className="text-slate-400">{startBrace}</span>
        {!expanded && !isEmpty && (
          <span className="text-slate-500 text-xs px-1">
            {isArray ? `${value.length} items` : `${Object.keys(value).length} keys`}
          </span>
        )}
        {!expanded && <span className="text-slate-400">{endBrace}{!isLast ? "," : ""}</span>}
      </div>

      {expanded && !isEmpty && (
        <div className="pl-4 border-l border-slate-800/60 ml-2">
          {Object.entries(value).map(([key, val], idx, arr) => (
            <JsonNode
              key={key}
              label={isArray ? undefined : key}
              value={val}
              isLast={idx === arr.length - 1}
              depth={depth + 1}
            />
          ))}
        </div>
      )}

      {expanded && !isEmpty && (
        <div className="flex px-1 py-0.5">
          <span className="w-4 shrink-0 inline-block"></span>
          <span className="text-slate-400">{endBrace}{!isLast ? "," : ""}</span>
        </div>
      )}
    </div>
  );
};

export default function JsonTreeViewer({ data }: { data: any }) {
  if (data === undefined) return null;
  return (
    <div className="text-slate-300 overflow-x-auto p-2">
      <JsonNode value={data} isLast={true} depth={0} />
    </div>
  );
}
