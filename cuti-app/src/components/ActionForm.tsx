"use client";

import { useTransition, type FormHTMLAttributes } from "react";

type Props = Omit<FormHTMLAttributes<HTMLFormElement>, "action" | "onSubmit"> & {
  action: (data: FormData) => void;
};

/**
 * Submit useActionState without React's automatic uncontrolled-form reset.
 * All consumers redirect on success; on a returned validation error, inputs
 * (including files/passwords) stay in this browser, without a server echo.
 */
export function ActionForm({ action, ...props }: Props) {
  const [pending, startTransition] = useTransition();
  return (
    <form
      {...props}
      action={action}
      aria-busy={pending}
      onSubmit={(event) => {
        event.preventDefault();
        const submitter = (event.nativeEvent as SubmitEvent).submitter;
        const data = new FormData(event.currentTarget, submitter);
        // Keep the action prop for pre-hydration submission. After hydration,
        // preventDefault avoids the host reset; dispatch still runs in an Action.
        startTransition(() => action(data));
      }}
    />
  );
}
