import { useEffect } from 'react'

/** Keep the browser tab title in sync during client-side navigation. */
export function usePageTitle(title: string | undefined) {
  useEffect(() => {
    if (title) document.title = title
  }, [title])
}
