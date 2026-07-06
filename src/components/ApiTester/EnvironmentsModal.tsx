import React, { useState } from "react";
import { X, Plus, Trash2, Check } from "lucide-react";

export type Environment = {
  id: string;
  name: string;
  variables: { key: string; value: string }[];
};

export default function EnvironmentsModal({
  environments,
  setEnvironments,
  activeEnvId,
  setActiveEnvId,
  onClose,
}: {
  environments: Environment[];
  setEnvironments: (env: Environment[]) => void;
  activeEnvId: string;
  setActiveEnvId: (id: string) => void;
  onClose: () => void;
}) {
  const [editingEnvId, setEditingEnvId] = useState<string | null>(
    environments.length > 0 ? environments[0].id : null,
  );

  const handleAddEnv = () => {
    const newEnv: Environment = {
      id: Date.now().toString(),
      name: `New Environment ${environments.length + 1}`,
      variables: [{ key: "", value: "" }],
    };
    setEnvironments([...environments, newEnv]);
    setEditingEnvId(newEnv.id);
  };

  const handleUpdateEnv = (id: string, updates: Partial<Environment>) => {
    setEnvironments(
      environments.map((env) => (env.id === id ? { ...env, ...updates } : env)),
    );
  };

  const handleDeleteEnv = (id: string) => {
    const next = environments.filter((e) => e.id !== id);
    setEnvironments(next);
    if (activeEnvId === id) setActiveEnvId("");
    if (editingEnvId === id) setEditingEnvId(next[0]?.id || null);
  };

  const activeEditEnv = environments.find((e) => e.id === editingEnvId);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-3xl flex flex-col h-[80vh] overflow-hidden shadow-2xl">
        <div className="flex items-center justify-between p-4 border-b border-slate-800 bg-slate-950/50">
          <h2 className="text-lg font-bold text-slate-100">Manage Environments</h2>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Sidebar */}
          <div className="w-64 border-r border-slate-800 bg-slate-950/30 flex flex-col">
            <div className="p-3 border-b border-slate-800 flex justify-between items-center">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Environments</span>
              <button onClick={handleAddEnv} className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-white">
                <Plus className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {environments.map((env) => (
                <div
                  key={env.id}
                  className={`flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer text-sm ${
                    editingEnvId === env.id ? "bg-blue-600/20 text-blue-400 font-bold" : "text-slate-300 hover:bg-slate-800/50"
                  }`}
                  onClick={() => setEditingEnvId(env.id)}
                >
                  <div className="flex items-center gap-2 truncate">
                    {activeEnvId === env.id && <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />}
                    <span className="truncate">{env.name}</span>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteEnv(env.id);
                    }}
                    className="p-1 text-slate-500 hover:text-rose-400 opacity-0 group-hover:opacity-100 hover:bg-rose-400/10 rounded"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
              {environments.length === 0 && (
                <div className="text-center p-4 text-sm text-slate-500">No environments</div>
              )}
            </div>
          </div>

          {/* Main Area */}
          <div className="flex-1 flex flex-col bg-slate-900">
            {activeEditEnv ? (
              <>
                <div className="p-4 border-b border-slate-800 flex items-center justify-between">
                  <input
                    type="text"
                    value={activeEditEnv.name}
                    onChange={(e) => handleUpdateEnv(activeEditEnv.id, { name: e.target.value })}
                    className="bg-transparent text-lg font-bold text-white focus:outline-none focus:ring-2 ring-blue-500/30 rounded px-2 py-1 w-1/2"
                  />
                  <label className="flex items-center space-x-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={activeEnvId === activeEditEnv.id}
                      onChange={(e) => setActiveEnvId(e.target.checked ? activeEditEnv.id : "")}
                      className="w-4 h-4 rounded border-slate-700 bg-slate-800 text-blue-500"
                    />
                    <span className="text-slate-300">Set as Active</span>
                  </label>
                </div>
                <div className="flex-1 p-4 overflow-y-auto">
                  <div className="grid grid-cols-12 gap-2 text-xs font-bold text-slate-400 mb-2">
                    <div className="col-span-5">VARIABLE (e.g. baseUrl)</div>
                    <div className="col-span-6">VALUE</div>
                  </div>
                  {activeEditEnv.variables.map((v, i) => (
                    <div key={i} className="grid grid-cols-12 gap-2 mb-2 items-center">
                      <div className="col-span-5">
                        <input
                          type="text"
                          value={v.key}
                          onChange={(e) => {
                            const vars = [...activeEditEnv.variables];
                            vars[i].key = e.target.value;
                            if (i === vars.length - 1 && e.target.value) vars.push({ key: "", value: "" });
                            handleUpdateEnv(activeEditEnv.id, { variables: vars });
                          }}
                          placeholder="variable_name"
                          className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm font-mono text-slate-200 focus:border-blue-500 outline-none"
                        />
                      </div>
                      <div className="col-span-6">
                        <input
                          type="text"
                          value={v.value}
                          onChange={(e) => {
                            const vars = [...activeEditEnv.variables];
                            vars[i].value = e.target.value;
                            if (i === vars.length - 1 && e.target.value) vars.push({ key: "", value: "" });
                            handleUpdateEnv(activeEditEnv.id, { variables: vars });
                          }}
                          placeholder="Value"
                          className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm font-mono text-slate-200 focus:border-blue-500 outline-none"
                        />
                      </div>
                      <div className="col-span-1 text-center">
                        <button
                          onClick={() => {
                            if (i === activeEditEnv.variables.length - 1) return;
                            const vars = activeEditEnv.variables.filter((_, idx) => idx !== i);
                            handleUpdateEnv(activeEditEnv.id, { variables: vars });
                          }}
                          className="p-2 text-slate-500 hover:text-rose-400"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-slate-500">
                Select or create an environment
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
