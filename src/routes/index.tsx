import { createFileRoute } from "@tanstack/react-router";
import { VoltaApp } from "@/components/synth/volta-app";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  return <VoltaApp />;
}
