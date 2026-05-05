import { ExternalLink, Briefcase, Linkedin, Globe, ArrowUpRight, ArrowRight } from "lucide-react";
import type { TemplateData } from "./TechTemplate";

function parseDisplayName(data: TemplateData): string {
  const firstLine = data.brief?.split('\n')[0]?.trim();
  if (firstLine && firstLine.length < 60 && firstLine.includes(' ')) return firstLine;
  if (data.contactEmail) return data.contactEmail.split('@')[0].replace(/[._-]/g, ' ');
  return data.slug;
}

function linkLabel(type: string): string {
  if (type === 'linkedin') return 'LinkedIn';
  if (type === 'portfolio') return 'Portfolio';
  if (type === 'linktree') return 'Links';
  return 'Connect';
}

function DestinationIcon({ type, url }: { type: string, url?: string }) {
  const t = url?.toLowerCase() || type?.toLowerCase() || '';
  if (t.includes('linkedin')) return <Linkedin className="w-4 h-4" />;
  if (t === 'portfolio' || type === 'portfolio') return <Globe className="w-4 h-4" />;
  return <ArrowUpRight className="w-4 h-4" />;
}

export function BusinessTemplate({ data }: { data: TemplateData }) {
  const name = parseDisplayName(data);
  const briefLines = data.brief?.split('\n').filter(Boolean) ?? [];
  const title = briefLines.length > 1 ? briefLines[1]?.trim() : '';
  const bio = briefLines.length > 2 ? briefLines.slice(2).join(' ') : (briefLines[1] || '');

  const hasLinks = data.links && data.links.length > 0;

  return (
    <div className="min-h-screen bg-[#0d0d0d] text-white flex flex-col items-center justify-center p-6">
      {/* Noise texture */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 opacity-[0.03] mix-blend-overlay"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
        }}
      />

      <div className="relative w-full max-w-sm animate-in fade-in slide-in-from-bottom-4 duration-700">
        {/* Gold glow */}
        <div className="absolute -inset-[1px] rounded-2xl bg-gradient-to-b from-[#c9a96e]/30 via-transparent to-transparent pointer-events-none" />

        <div className="relative rounded-2xl border border-[#c9a96e]/20 bg-[#111]/80 backdrop-blur-sm overflow-hidden flex flex-col max-h-[85vh]">
          {/* Top border accent */}
          <div className="h-px bg-gradient-to-r from-transparent via-[#c9a96e]/60 to-transparent shrink-0" />

          <div className="px-8 py-10 space-y-8 overflow-y-auto no-scrollbar">
            {/* Monogram + name */}
            <div className="space-y-5">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full border border-[#c9a96e]/30 bg-[#c9a96e]/5 text-[#c9a96e]">
                  <Briefcase className="w-4 h-4" />
                </div>
                <p className="text-[10px] uppercase tracking-[0.35em] text-[#c9a96e]/60">Business Edition</p>
              </div>

              <div>
                <h1 className="text-2xl font-light tracking-wide capitalize leading-snug">{name}</h1>
                {title && (
                  <p className="mt-1.5 text-sm text-[#c9a96e]/70 font-light tracking-wide">{title}</p>
                )}
              </div>
            </div>

            {/* Bio */}
            {bio && (
              <div className="relative">
                <div className="absolute left-0 top-0 bottom-0 w-px bg-gradient-to-b from-[#c9a96e]/40 to-transparent" />
                <p className="pl-4 text-sm leading-relaxed text-white/50 font-serif italic">"{bio}"</p>
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
                    className="group flex items-center justify-between w-full border border-[#c9a96e]/20 bg-black/40 px-5 py-4 transition-all duration-200 ease-out hover:border-[#c9a96e]/40 hover:bg-[#c9a96e]/5 active:scale-[0.97]"
                  >
                    <div className="flex items-center gap-4">
                      <div className="text-[#c9a96e]/60 group-hover:text-[#c9a96e] transition-colors">
                        <DestinationIcon type={data.destinationType} url={link.url} />
                      </div>
                      <div>
                        <p className="text-sm font-light tracking-wide">{link.title}</p>
                        <p className="text-[10px] text-white/25 mt-0.5 truncate max-w-[160px]">{link.url.replace(/^https?:\/\//, '')}</p>
                      </div>
                    </div>
                    <ArrowUpRight className="w-4 h-4 text-[#c9a96e]/40 transition-all duration-200 group-hover:text-[#c9a96e]/80 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                  </a>
                ))
              ) : (
                <a
                  href={data.targetUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex items-center justify-between w-full border border-[#c9a96e]/20 bg-black/40 px-5 py-4 transition-all duration-200 ease-out hover:border-[#c9a96e]/40 hover:bg-[#c9a96e]/5 active:scale-[0.97]"
                >
                  <div className="flex items-center gap-4">
                    <div className="text-[#c9a96e]/60 group-hover:text-[#c9a96e] transition-colors">
                      <DestinationIcon type={data.destinationType} url={data.targetUrl} />
                    </div>
                    <div>
                      <p className="text-sm font-light tracking-wide">{linkLabel(data.destinationType)}</p>
                      <p className="text-[10px] text-white/25 mt-0.5 truncate max-w-[160px]">{data.targetUrl.replace(/^https?:\/\//, '')}</p>
                    </div>
                  </div>
                  <ArrowUpRight className="w-4 h-4 text-[#c9a96e]/40 transition-all duration-200 group-hover:text-[#c9a96e]/80 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                </a>
              )}
            </div>
          </div>

          {/* Bottom border accent */}
          <div className="h-px bg-gradient-to-r from-transparent via-[#c9a96e]/20 to-transparent shrink-0" />

          <div className="px-8 py-4 flex items-center justify-between shrink-0 bg-[#111]/90 backdrop-blur-md">
            <p className="text-[9px] uppercase tracking-[0.35em] text-white/15 font-light">QONNECT</p>
            <p className="text-[9px] text-white/15 font-mono">/{data.slug}</p>
          </div>
        </div>
      </div>

      {/* Viral Loop CTA */}
      <a 
        href="/"
        className="mt-8 flex items-center gap-2 group"
      >
        <p className="text-[10px] uppercase tracking-[0.3em] text-white/20 group-hover:text-[#c9a96e] transition-colors duration-300">
          Get your own QONNECT Bridge
        </p>
        <ArrowRight className="w-3 h-3 text-white/20 group-hover:text-[#c9a96e] group-hover:translate-x-1 transition-all duration-300" />
      </a>
    </div>
  );
}
