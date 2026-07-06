import React, { useState } from "react";
import { X, Copy, Check } from "lucide-react";

export default function CodeSnippetsModal({
  requestConfig,
  onClose,
}: {
  requestConfig: {
    method: string;
    url: string;
    headers: Record<string, string>;
    body?: string;
  };
  onClose: () => void;
}) {
  const [activeTab, setActiveTab] = useState("curl");
  const [copied, setCopied] = useState(false);

  const { method, url, headers, body } = requestConfig;

  const getCurlSnippet = () => {
    let snippet = `curl --request ${method} \\\n  --url '${url}'`;
    Object.entries(headers).forEach(([k, v]) => {
      snippet += ` \\\n  --header '${k}: ${v}'`;
    });
    if (body) {
      // Escape single quotes for bash
      const escapedBody = body.replace(/'/g, "'\\''");
      snippet += ` \\\n  --data '${escapedBody}'`;
    }
    return snippet;
  };

  const getFetchSnippet = () => {
    let snippet = `const options = {\n  method: '${method}',\n  headers: ${JSON.stringify(headers, null, 4).replace(/\n/g, "\n  ")}`;
    if (body) {
      // If it's pure JSON, stringify, else keep as is
      try {
        JSON.parse(body);
        snippet += `,\n  body: JSON.stringify(${body.replace(/\n/g, "\n  ")})`;
      } catch {
        snippet += `,\n  body: \`${body.replace(/`/g, "\\`")}\``;
      }
    }
    snippet += `\n};\n\nfetch('${url}', options)\n  .then(response => response.json())\n  .then(response => console.log(response))\n  .catch(err => console.error(err));`;
    return snippet;
  };

  const getPythonSnippet = () => {
    let snippet = `import requests\n\nurl = "${url}"\n\n`;
    if (body) {
      try {
        JSON.parse(body);
        snippet += `payload = ${body}\n`;
      } catch {
        snippet += `payload = """${body}"""\n`;
      }
    }
    snippet += `headers = ${JSON.stringify(headers, null, 4)}\n\n`;
    snippet += `response = requests.request("${method}", url, `;
    if (body) {
      if (headers["Content-Type"]?.includes("json") || headers["content-type"]?.includes("json")) {
        snippet += `json=payload, `;
      } else {
        snippet += `data=payload, `;
      }
    }
    snippet += `headers=headers)\n\nprint(response.text)`;
    return snippet;
  };

  const snippets: Record<string, string> = {
    curl: getCurlSnippet(),
    fetch: getFetchSnippet(),
    python: getPythonSnippet(),
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(snippets[activeTab]);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-3xl flex flex-col h-[70vh] overflow-hidden shadow-2xl">
        <div className="flex items-center justify-between p-4 border-b border-slate-800 bg-slate-950/50">
          <h2 className="text-lg font-bold text-slate-100">Code Snippets</h2>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Sidebar */}
          <div className="w-48 border-r border-slate-800 bg-slate-950/30 flex flex-col p-2 space-y-1">
            {[
              { id: "curl", label: "cURL" },
              { id: "fetch", label: "JavaScript (Fetch)" },
              { id: "python", label: "Python (Requests)" },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`text-left px-3 py-2 rounded-lg text-sm font-bold transition-colors ${
                  activeTab === tab.id
                    ? "bg-blue-600/20 text-blue-400"
                    : "text-slate-400 hover:bg-slate-800/50 hover:text-slate-200"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Code Area */}
          <div className="flex-1 flex flex-col relative bg-slate-950">
            <div className="absolute top-4 right-4 z-10">
              <button
                onClick={handleCopy}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? "Copied!" : "Copy"}
              </button>
            </div>
            <pre className="flex-1 p-4 overflow-auto font-mono text-[13px] leading-relaxed text-slate-300 hidden-scrollbar selection:bg-blue-500/30">
              {snippets[activeTab]}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
}
