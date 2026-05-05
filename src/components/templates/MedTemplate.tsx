import { ExternalLink, Cross, Linkedin, Globe, ArrowRight } from "lucide-react";
import type { TemplateData } from "./TechTemplate";

function parseDisplayName(data: TemplateData): string {
  const firstLine = data.brief?.split('\n')[0]?.trim();
  if (firstLine && firstLine.length < 60 && firstLine.includes(' ')) return firstLine;
  if (data.contactEmail) return data.contactEmail.split('@')[0].replace(/[._-]/g, ' ');
  return data.slug;
}

function linkLabel(type: string): string {
  if (type === 'linkedin') return 'LinkedIn Profile';
  if (type === 'portfolio') return 'Professional Portfolio';
  if (type === 'linktree') return 'Links & Resources';
  return 'Professional Page';
}

function DestinationIcon({ type, url }: { type: string, url?: string }) {
  const t = url?.toLowerCase() || type?.toLowerCase() || '';
  if (t.includes('linkedin')) return <Linkedin className="w-4 h-4" />;
  if (t === 'portfolio' || type === 'portfolio') return <Globe className="w-4 h-4" />;
  return <ExternalLink className="w-4 h-4" />;
}

export function MedTemplate({ data }: { data: TemplateData }) {
  const name = parseDisplayName(data);
  const briefLines = data.brief?.split('\n').filter(Boolean) ?? [];
  const specialty = briefLines.length > 1 ? briefLines[1]?.trim() : '';
  const bio = briefLines.length > 2 ? briefLines.slice(2).join(' ') : (briefLines[1] || '');

  const hasLinks = data.links && data.links.length > 0;

  return (
    <div className="min-h-screen bg-[#f7f8fa] text-[#1a1a2e] flex flex-col items-center justify-center p-6">
      {/* Subtle pattern */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 opacity-[0.025]"
        style={{
          backgroundImage: `radial-gradient(circle, #1a1a2e 1px, transparent 1px)`,
          backgroundSize: '24px 24px',
        }}
      />

      <div className="relative w-full max-w-sm animate-in fade-in slide-in-from-bottom-4 duration-700">
        <div className="rounded-2xl border border-slate-200 bg-white shadow-xl shadow-slate-100 overflow-hidden flex flex-col max-h-[85vh]">
          {/* Top accent */}
          <div className="h-1 bg-gradient-to-r from-blue-500 via-teal-400 to-blue-500 shrink-0" />

          <div className="px-8 py-10 space-y-7 overflow-y-auto no-scrollbar">
            {/* Icon + name */}
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-blue-50 border border-blue-100">
                <Cross className="w-5 h-5 text-blue-500" />
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-[0.25em] text-slate-400 mb-1">Medical Professional</p>
                <h1 className="text-xl font-semibold text-[#1a1a2e] capitalize leading-tight">{name}</h1>
                {specialty && (
                  <p className="text-sm text-blue-600 mt-1 font-medium">{specialty}</p>
                )}
              </div>
            </div>

            {/* Bio */}
            {bio && (
              <div className="rounded-xl bg-slate-50 border border-slate-100 px-5 py-4">
                <p className="text-sm leading-6 text-slate-600 italic">{bio}</p>
              </div>
            )}

            {/* Links Section */}
            <div className="space-y-3 pt-2">
              {hasLinks ? (
                data.links!.map((link, idx) => (
                  <a
                    key={idx}
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group flex items-center justify-between w-full rounded-xl border border-blue-100 bg-blue-50 px-5 py-4 transition-all duration-200 ease-out hover:border-blue-200 hover:bg-blue-100/70 active:scale-[0.97]"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100 text-blue-600">
                        <DestinationIcon type={data.destinationType} url={link.url} />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-[#1a1a2e]">{link.title}</p>
                        <p className="text-[10px] text-slate-400 truncate max-w-[160px]">{link.url.replace(/^https?:\/\//, '')}</p>
                      </div>
                    </div>
                    <ExternalLink className="w-3.5 h-3.5 text-slate-300 transition-all duration-200 group-hover:text-blue-500 group-hover:translate-x-0.5" />
                  </a>
                ))
              ) : (
                <a
                  href={data.targetUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex items-center justify-between w-full rounded-xl border border-blue-100 bg-blue-50 px-5 py-4 transition-all duration-200 ease-out hover:border-blue-200 hover:bg-blue-100/70 active:scale-[0.97]"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100 text-blue-600">
                      <DestinationIcon type={data.destinationType} url={data.targetUrl} />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-[#1a1a2e]">{linkLabel(data.destinationType)}</p>
                      <p className="text-[10px] text-slate-400 truncate max-w-[160px]">{data.targetUrl.replace(/^https?:\/\//, '')}</p>
                    </div>
                  </div>
                  <ExternalLink className="w-3.5 h-3.5 text-slate-300 transition-all duration-200 group-hover:text-blue-500 group-hover:translate-x-0.5" />
                </a>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="border-t border-slate-100 px-8 py-4 flex items-center justify-between bg-slate-50/50 shrink-0">
            <p className="text-[9px] uppercase tracking-[0.3em] text-slate-300">QONNECT</p>
            <p className="text-[9px] text-slate-300 font-mono">/{data.slug}</p>
          </div>
        </div>
      </div>

      {/* Viral Loop CTA */}
      <a 
        href="/"
        className="mt-8 flex items-center gap-2 group"
      >
        <p className="text-[10px] uppercase tracking-[0.3em] text-slate-300 group-hover:text-blue-500 transition-colors duration-300">
          Get your own QONNECT Bridge
        </p>
        <ArrowRight className="w-3 h-3 text-slate-300 group-hover:text-blue-500 group-hover:translate-x-1 transition-all duration-300" />
      </a>
    </div>
  );
}
