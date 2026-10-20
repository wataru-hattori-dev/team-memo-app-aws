import { useState, type FormEvent } from 'react'
import { toUserErrorMessage } from '../api/client'
import { createMemo } from '../api/memos'
import type { Memo } from '../types/memo'

function parseTags(raw: string): string[] {
  return raw
    .split(/[,、]/)
    .map((t) => t.trim())
    .filter((t) => t.length > 0)
}

type MemoCreateFormProps = {
  onSuccess?: (memo: Memo) => void
  onCancel?: () => void
}

export function MemoCreateForm({ onSuccess, onCancel }: MemoCreateFormProps) {
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [author, setAuthor] = useState('')
  const [tagsInput, setTagsInput] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setErrorMessage(null)
    setSubmitting(true)

    try {
      const memo = await createMemo({
        title,
        body,
        author,
        tags: parseTags(tagsInput),
      })
      setTitle('')
      setBody('')
      setAuthor('')
      setTagsInput('')
      onSuccess?.(memo)
    } catch (err) {
      setErrorMessage(toUserErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="mx-auto w-full max-w-xl">
      <form
        onSubmit={handleSubmit}
        className="flex flex-col gap-5"
        noValidate
      >
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-stone-700">タイトル</span>
          <input
            type="text"
            name="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={200}
            required
            disabled={submitting}
            className="rounded border border-stone-300 bg-white px-3 py-2 text-stone-900 outline-none focus:border-teal-600 focus:ring-1 focus:ring-teal-600"
            placeholder="例: ツリーファイルについて"
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-stone-700">本文</span>
          <textarea
            name="body"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            maxLength={10000}
            required
            rows={6}
            disabled={submitting}
            className="resize-y rounded border border-stone-300 bg-white px-3 py-2 text-stone-900 outline-none focus:border-teal-600 focus:ring-1 focus:ring-teal-600"
            placeholder="メモの内容を入力"
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-stone-700">作成者</span>
          <input
            type="text"
            name="author"
            value={author}
            onChange={(e) => setAuthor(e.target.value)}
            maxLength={100}
            required
            disabled={submitting}
            className="rounded border border-stone-300 bg-white px-3 py-2 text-stone-900 outline-none focus:border-teal-600 focus:ring-1 focus:ring-teal-600"
            placeholder="例: 山田 太郎"
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-stone-700">
            タグ（任意・カンマ区切り）
          </span>
          <input
            type="text"
            name="tags"
            value={tagsInput}
            onChange={(e) => setTagsInput(e.target.value)}
            disabled={submitting}
            className="rounded border border-stone-300 bg-white px-3 py-2 text-stone-900 outline-none focus:border-teal-600 focus:ring-1 focus:ring-teal-600"
            placeholder="例: sprint, shared"
          />
        </label>

        <div className="flex flex-wrap gap-3">
          <button
            type="submit"
            disabled={submitting}
            className="rounded bg-teal-700 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? '保存中…' : 'メモを保存'}
          </button>
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              disabled={submitting}
              className="rounded border border-stone-300 bg-white px-4 py-2.5 text-sm font-medium text-stone-700 transition hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              一覧へ戻る
            </button>
          )}
        </div>
      </form>

      {errorMessage && (
        <div
          role="alert"
          className="mt-6 rounded border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800"
        >
          {errorMessage}
        </div>
      )}
    </div>
  )
}
