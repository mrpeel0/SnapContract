import { Suspense } from "react";
import { Workspace } from "@/components/Workspace";

async function Inner({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <Workspace id={id} />;
}

export default function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<div className="h-screen grid place-items-center"><div className="dot-pulse flex gap-1.5"><span /><span /><span /></div></div>}>
      <Inner params={params} />
    </Suspense>
  );
}
