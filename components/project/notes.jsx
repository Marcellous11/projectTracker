import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import Module from "@/components/hud/module.jsx";
import { StickyNote } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

function Markdown({ children }) {
  return (
    <div className="md-body">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{children}</ReactMarkdown>
    </div>
  );
}

export default function Notes({ statusMarkdown, readme, xkcd = null }) {
  const showXkcdFooter = xkcd && !statusMarkdown && !readme?.present;
  return (
    <Module title="Notes" voice="briefing" caption="STATUS.md · README" icon={StickyNote}>
      <Tabs defaultValue={statusMarkdown ? "status" : (readme?.present ? "readme" : "status")}>
        <TabsList>
          <TabsTrigger value="status">STATUS.md</TabsTrigger>
          <TabsTrigger value="readme">README</TabsTrigger>
        </TabsList>
        <TabsContent value="status" className="mt-4">
          {statusMarkdown ? (
            <Markdown>{statusMarkdown}</Markdown>
          ) : (
            <EmptyState xkcd={xkcd} kind="STATUS.md" />
          )}
        </TabsContent>
        <TabsContent value="readme" className="mt-4">
          {readme?.present ? (
            <Markdown>{readme.content}</Markdown>
          ) : (
            <EmptyState xkcd={xkcd} kind="README" />
          )}
        </TabsContent>
      </Tabs>
    </Module>
  );
}

function EmptyState({ xkcd, kind }) {
  return (
    <div className="flex flex-col gap-4">
      <p className="text-[13px] text-hud-ink-dim">No {kind} in this folder.</p>
      {xkcd && (
        <a
          href={xkcd.link}
          target="_blank"
          rel="noreferrer"
          className="block opacity-40 hover:opacity-90 transition-opacity max-w-[280px]"
          title={xkcd.alt}
        >
          <div className="text-[11px] text-hud-ink-dim mb-1">
            XKCD #{xkcd.num} · {xkcd.title}
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={xkcd.img} alt={xkcd.title} className="w-full h-auto border border-hud-border/40" />
        </a>
      )}
    </div>
  );
}
