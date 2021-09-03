import { onMounted, onBeforeUnmount } from 'vue'

export default function useDisableHistoryChange() {
  const historyHandler = () => history.pushState(null, null, document.URL)

  onMounted(() => {
    history.pushState(null, null, document.URL);
    window.addEventListener('popstate', historyHandler)
  })

  onBeforeUnmount(() => {
    window.removeEventListener('popstate', historyHandler)
  })
}
