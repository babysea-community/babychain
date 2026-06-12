'use client';

import { cn } from '../../lib/utils';

export function InlineBabyChain({
  className,
  ...props
}: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 21590 27940"
      className={cn(className)}
      {...props}
    >
      <rect fill="#33AAFF" x="2328" y="5503" width="16933" height="16933" />
      <path
        fill="#0A0C10"
        d="M10587 12273c-442,692 -1195,1958 -1195,1958 -845,1370 -2612,2492 -3652,3040 -286,130 -559,900 -403,1135 650,1135 2417,2557 5666,-2753 1195,-1983 1195,-1944 1195,-1944 884,-1344 2612,-2506 3652,-3093 286,-130 559,-887 403,-1122 -650,-1096 -2300,-2492 -5666,2779z"
      />
    </svg>
  );
}
