import { ExternalLink, Cpu, Github, Linkedin, Globe } from "lucide-react";

export interface TemplateData {
  slug: string;
  brief: string;
  targetUrl: string;
  destinationType: string;
  edition: string;
  contactEmail: string | null;
}

function parseDisplayName(data: TemplateData): string {
  const firstLine = data.brief?.split('\n')[0]?.trim();
  if (firstLine && firstLine.length < 60 && !firstLine.includes(' ') === false) return firstLine;
  if (data.contactEmail) return data.contactEmail.split('@')[0].replace(/[._-]/g, ' ');
  return data.slug;
}

function DestinationIcon({ type }: { type: string }) {
  if (type === 'linkedin') return <Linkedin className="w-4 h-4" />;
  if (type === 'portfolio') return <Globe className="w-4 h-4" />;
  return <ExternalLink className="w-4 h-4" />;
}

function linkLabel(type: string): string {
  if (type === 'linkedin') return 'LinkedIn';
  if (type === 'portfolio') return 'Portfolio';
  if (type === 'linktree') return 'Links';
  return 'Visit';
}

export function TechTemplate({ data }: { data: TemplateData }) {
  const name = parseDisplayName(data);
  const briefLines = data.brief?.split('\n').filter(Boolean) ?? [];
  const bio = briefLines.length > 1 ? briefLines.slice(1).join(' ') : (briefLines[0] || '');

  return (
    <div className="min-h-screen bg-[#080808] text-white flex flex-col items-center justify-center p-6 font-mono">
      {/* Grid texture */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 opacity-[0.04]"
        style={{
          backgroundImage: `linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)`,
          backgroundSize: '40px 40px',
        }}
      />

      <div className="relative w-full max-w-sm animate-in fade-in slide-in-from-bottom-4 duration-700">
        {/* Glow */}
        <div className="absolute -inset-px rounded-2xl bg-gradient-to-b from-emerald-500/20 to-transparent pointer-events-none" />

        <div className="relative rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-sm overflow-hidden">
          {/* Header bar */}
          <div className="flex items-center gap-2 border-b border-white/5 px-5 py-3">
            <Cpu className="w-3.5 h-3.5 text-emerald-400" />
            <span className="text-[10px] uppercase tracking-[0.3em] text-white/30">QONNECT — Tech Edition</span>
          </div>

          <div className="px-7 py-10 space-y-8">
            {/* Name */}
            <div>
              <p className="text-[10px] uppercase tracking-[0.3em] text-emerald-400/70 mb-3">Identity</p>
              <h1 className="text-3xl font-bold tracking-tight capitalize leading-tight">{name}</h1>
            </div>

            {/* Bio */}
            {bio && (
              <div>
                <p className="text-[10px] uppercase tracking-[0.3em] text-white/30 mb-3">About</p>
                <p className="text-sm leading-6 text-white/60">{bio}</p>
              </div>
            )}

            {/* Divider */}
            <div className="border-t border-white/5" />

            {/* CTA */}
            <a
              href={data.targetUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex items-center justify-between w-full rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-5 py-4 transition-all duration-200 ease-out hover:border-emerald-500/40 hover:bg-emerald-500/10 active:scale-[0.97]"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400">
                  <DestinationIcon type={data.destinationType} />
                </div>
                <div>
                  <p className="text-sm font-medium">{linkLabel(data.destinationType)}</p>
                  <p className="text-[10px] text-white/30 truncate max-w-[160px]">{data.targetUrl.replace(/^https?:\/\//, '')}</p>
                </div>
              </div>
              <ExternalLink className="w-3.5 h-3.5 text-white/20 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-emerald-400" />
            </a>
          </div>

          {/* Footer */}
          <div className="border-t border-white/5 px-7 py-4 flex items-center justify-between">
            <p className="text-[9px] uppercase tracking-[0.3em] text-white/20">QONNECT</p>
            <p className="text-[9px] text-white/20 font-mono">/{data.slug}</p>
          </div>
        </div>
      </div>

      <p className="mt-8 text-[10px] uppercase tracking-[0.3em] text-white/10">
        Scanned from a QONNECT garment
      </p>
    </div>
  );
}
