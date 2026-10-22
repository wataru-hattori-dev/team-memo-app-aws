import { useState } from 'react'
import { MemoCreateForm } from './components/MemoCreateForm'
import { MemoDetail } from './components/MemoDetail'
import { MemoEditForm } from './components/MemoEditForm'
import { MemoList } from './components/MemoList'
import type { Memo } from './types/memo'

type AppView =
  | { kind: 'list' }
  | { kind: 'create' }
  | { kind: 'detail'; memo: Memo }
  | { kind: 'edit'; memo: Memo }

function viewSubtitle(view: AppView): string {
  switch (view.kind) {
    case 'list':
      return '保存済みメモの一覧'
    case 'create':
      return '新しいメモを作成してチームに共有'
    case 'detail':
      return 'メモの内容を確認'
    case 'edit':
      return 'メモを編集して保存'
  }
}

function App() {
  const [view, setView] = useState<AppView>({ kind: 'list' })
  const [listRefreshKey, setListRefreshKey] = useState(0)

  function goToList(refresh = false) {
    if (refresh) {
      setListRefreshKey((key) => key + 1)
    }
    setView({ kind: 'list' })
  }

  function goToDetail(memo: Memo, refreshList = false) {
    if (refreshList) {
      setListRefreshKey((key) => key + 1)
    }
    setView({ kind: 'detail', memo })
  }

  return (
    <div className="min-h-screen bg-stone-100 text-stone-900">
      <header className="border-b border-stone-200 bg-white">
        <div className="mx-auto flex max-w-xl flex-col gap-1 px-4 py-8">
          <p className="text-xs font-medium tracking-wide text-teal-800 uppercase">
            team-memo-app
          </p>
          <h1 className="text-2xl font-semibold tracking-tight">
            チーム共有メモ
          </h1>
          <p className="text-sm text-stone-600">{viewSubtitle(view)}</p>
        </div>
      </header>

      <main className="mx-auto max-w-xl px-4 py-8">
        {view.kind === 'list' && (
          <MemoList
            refreshKey={listRefreshKey}
            onCreateClick={() => setView({ kind: 'create' })}
            onDetailClick={(memo) => goToDetail(memo)}
          />
        )}

        {view.kind === 'create' && (
          <>
            <h2 className="mb-6 text-lg font-medium">メモを作成</h2>
            <MemoCreateForm
              onSuccess={() => goToList(true)}
              onCancel={() => goToList(false)}
            />
          </>
        )}

        {view.kind === 'detail' && (
          <MemoDetail
            memo={view.memo}
            onEditClick={() => setView({ kind: 'edit', memo: view.memo })}
            onBackClick={() => goToList(false)}
            onDeleted={() => goToList(true)}
          />
        )}

        {view.kind === 'edit' && (
          <>
            <h2 className="mb-6 text-lg font-medium">メモを編集</h2>
            <MemoEditForm
              memo={view.memo}
              onSuccess={(updated) => goToDetail(updated, true)}
              onCancel={() => goToDetail(view.memo)}
            />
          </>
        )}
      </main>
    </div>
  )
}

export default App
