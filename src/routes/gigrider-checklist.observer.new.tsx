import { createFileRoute } from "@tanstack/react-router";
import { ObservationForm, emptyForm } from "@/components/gigrider/ObservationForm";

export const Route = createFileRoute("/gigrider-checklist/observer/new")({
  component: () => <ObservationForm initial={emptyForm} />,
});
