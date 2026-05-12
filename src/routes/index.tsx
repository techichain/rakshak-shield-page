import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  component: Index,
  head: () => ({
    meta: [
      { title: "Project Rakshak" },
      { name: "description", content: "Project Rakshak" },
    ],
  }),
});

function Index() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background">
      <h1 className="text-5xl font-bold tracking-tight text-foreground md:text-7xl">
        Project Rakshak
      </h1>
    </main>
  );
}
