import * as RadixToast from '@radix-ui/react-toast';
import { NotificationSeverity } from '~/common/types';
import { useToast } from '~/hooks';

const severityConfig = {
  [NotificationSeverity.INFO]: {
    border: 'border-l-blue-500',
    icon: (
      <svg className="h-4 w-4 text-blue-500" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
        <circle cx="12" cy="12" r="10" /><path d="M12 16v-4m0-4h.01" />
      </svg>
    ),
  },
  [NotificationSeverity.SUCCESS]: {
    border: 'border-l-emerald-500',
    icon: (
      <svg className="h-4 w-4 text-emerald-500" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  [NotificationSeverity.WARNING]: {
    border: 'border-l-amber-500',
    icon: (
      <svg className="h-4 w-4 text-amber-500" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
      </svg>
    ),
  },
  [NotificationSeverity.ERROR]: {
    border: 'border-l-red-500',
    icon: (
      <svg className="h-4 w-4 text-red-500" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 9.75l4.5 4.5m0-4.5l-4.5 4.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
};

export default function Toast() {
  const { toast, onOpenChange } = useToast();
  const config = severityConfig[toast.severity];

  return (
    <RadixToast.Root
      open={toast.open}
      onOpenChange={onOpenChange}
      className="toast-root"
      style={{
        height: '74px',
        marginBottom: '0px',
      }}
    >
      <div className="w-full p-1 text-center md:w-auto md:text-justify">
        <div
          className={`alert-root pointer-events-auto inline-flex flex-row items-start gap-2.5 rounded-lg border border-gray-200 dark:border-gray-700 border-l-4 ${config.border} bg-white dark:bg-gray-800 px-4 py-3 shadow-lg`}
        >
          {toast.showIcon && (
            <div className="mt-0.5 flex-shrink-0">
              {config.icon}
            </div>
          )}
          <RadixToast.Description className="flex-1">
            <div className="whitespace-pre-wrap text-left text-sm text-gray-800 dark:text-gray-200">{toast.message}</div>
          </RadixToast.Description>
        </div>
      </div>
    </RadixToast.Root>
  );
}
