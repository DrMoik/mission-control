// ─── FeedView ─────────────────────────────────────────────────────────────────
// Social feed: create posts (optionally with an image URL), view and add
// per-post comments.  Authors and admins may delete their own content.

import React, { useState } from 'react';
import { t } from '../strings.js';
import { tsToDate } from '../utils.js';

/**
 * @param {{
 *   posts:            object[],
 *   comments:         object[],
 *   authUser:         object | null,
 *   canEdit:          boolean,
 *   memberships:      object[],
 *   onCreatePost:     function(content: string, imageUrl: string | null): Promise<void>,
 *   onDeletePost:     function(id: string): Promise<void>,
 *   onCreateComment:  function(postId: string, text: string): Promise<void>,
 *   onDeleteComment:  function(id: string): Promise<void>,
 *   onViewProfile:    function(membership: object): void,
 * }} props
 */
export default function FeedView({
  posts, comments, authUser, canEdit, memberships,
  onCreatePost, onDeletePost, onCreateComment, onDeleteComment,   onViewProfile,
}) {
  const [newContent,     setNewContent]     = useState('');
  const [newImageUrl,    setNewImageUrl]    = useState('');
  const [showImageField, setShowImageField] = useState(false);
  const [expandedPostId, setExpandedPostId] = useState(null);
  const [commentDrafts,  setCommentDrafts]  = useState({});

  // ── Post / comment handlers ────────────────────────────────────────────────

  const handlePost = async () => {
    if (!newContent.trim()) return;
    await onCreatePost(newContent.trim(), newImageUrl.trim() || null);
    setNewContent('');
    setNewImageUrl('');
    setShowImageField(false);
  };

  const handleComment = async (postId) => {
    const text = (commentDrafts[postId] || '').trim();
    if (!text) return;
    await onCreateComment(postId, text);
    setCommentDrafts((d) => ({ ...d, [postId]: '' }));
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4 max-w-2xl">
      <h2 className="text-base font-semibold">Feed</h2>

      {/* Post composer */}
      <div className="bg-slate-800 rounded-lg p-4 space-y-2">
        <textarea rows={3} value={newContent} onChange={(e) => setNewContent(e.target.value)}
          placeholder={t('share_ph')}
          className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded text-sm resize-none" />
        {showImageField && (
          <input value={newImageUrl} onChange={(e) => setNewImageUrl(e.target.value)}
            placeholder={t('paste_img_ph')}
            className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded text-xs" />
        )}
        {newImageUrl && (
          <img src={newImageUrl} alt="preview" className="rounded-lg max-h-48 object-contain bg-slate-900 w-full" />
        )}
        <div className="flex items-center justify-between">
          <button onClick={() => setShowImageField((s) => !s)}
            className="text-xs text-slate-400 hover:text-slate-200 flex items-center gap-1 transition-colors">
            {showImageField ? t('remove_image_btn') : t('add_image_btn')}
          </button>
          <button onClick={handlePost} disabled={!newContent.trim()}
            className="px-4 py-1.5 bg-emerald-500 text-black text-xs font-semibold rounded disabled:opacity-40 transition-opacity">
            {t('post')}
          </button>
        </div>
      </div>

      {posts.length === 0 && (
        <div className="text-center text-xs text-slate-500 py-10">{t('no_posts_first')}</div>
      )}

      {/* Post list */}
      {posts.map((post) => {
        const postComments = comments
          .filter((c) => c.postId === post.id)
          .sort((a, b) => tsToDate(a.createdAt) - tsToDate(b.createdAt));
        const isExpanded = expandedPostId === post.id;
        const isOwn      = post.authorId === authUser?.uid;

        return (
          <div key={post.id} className="bg-slate-800 rounded-lg overflow-hidden">
            {/* Post body */}
            <div className="flex items-start gap-3 p-4">
              {post.authorPhoto ? (
                <img src={post.authorPhoto} className="w-9 h-9 rounded-full shrink-0" alt="" />
              ) : (
                <div className="w-9 h-9 rounded-full bg-slate-600 shrink-0 flex items-center justify-center text-sm font-bold">
                  {(post.authorName || '?')[0].toUpperCase()}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2 flex-wrap">
                  <button
                    onClick={() => { const m = memberships.find((mb) => mb.userId === post.authorId); if (m) onViewProfile?.(m); }}
                    className="text-sm font-semibold hover:underline">
                    {post.authorName}
                  </button>
                  <span className="text-[11px] text-slate-400">{tsToDate(post.createdAt).toLocaleString()}</span>
                </div>
                <p className="text-sm text-slate-200 mt-1.5 whitespace-pre-wrap leading-relaxed">{post.content}</p>
                {post.imageUrl && (
                  <img src={post.imageUrl} alt="" className="mt-2 rounded-lg max-h-80 object-contain bg-slate-900 w-full" />
                )}
              </div>
              {(canEdit || isOwn) && (
                <button onClick={() => onDeletePost(post.id)} className="shrink-0 text-[11px] text-red-400 underline">
                  {t('delete')}
                </button>
              )}
            </div>

            {/* Comment toggle */}
            <div className="border-t border-slate-700 px-4 py-2">
              <button onClick={() => setExpandedPostId(isExpanded ? null : post.id)}
                className="text-xs text-slate-400 hover:text-slate-200 transition-colors">
                {postComments.length > 0
                  ? t('comment_toggle')(postComments.length)
                  : t('add_a_comment_btn')
                } {isExpanded ? '▲' : '▼'}
              </button>
            </div>

            {/* Comment thread */}
            {isExpanded && (
              <div className="border-t border-slate-700 px-4 pb-4 pt-3 space-y-3">
                {postComments.map((c) => (
                  <div key={c.id} className="flex items-start gap-2">
                    <div className="w-7 h-7 rounded-full bg-slate-600 shrink-0 flex items-center justify-center text-xs font-bold">
                      {(c.authorName || '?')[0].toUpperCase()}
                    </div>
                    <div className="flex-1 bg-slate-700/60 rounded-lg px-3 py-2">
                      <div className="flex items-baseline gap-2">
                        <span className="text-xs font-semibold">{c.authorName}</span>
                        <span className="text-[10px] text-slate-500">{tsToDate(c.createdAt).toLocaleString()}</span>
                      </div>
                      <p className="text-xs text-slate-200 mt-0.5">{c.content}</p>
                    </div>
                    {(canEdit || c.authorId === authUser?.uid) && (
                      <button onClick={() => onDeleteComment(c.id)} className="text-[11px] text-red-400 shrink-0 mt-1">✕</button>
                    )}
                  </div>
                ))}
                <div className="flex gap-2 mt-1">
                  <input value={commentDrafts[post.id] || ''}
                    onChange={(e) => setCommentDrafts((d) => ({ ...d, [post.id]: e.target.value }))}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleComment(post.id); }}
                    placeholder={t('write_comment_ph')}
                    className="flex-1 px-3 py-1.5 bg-slate-900 border border-slate-600 rounded text-xs" />
                  <button onClick={() => handleComment(post.id)}
                    className="px-3 py-1.5 bg-slate-600 hover:bg-slate-500 text-white text-xs rounded transition-colors">
                    {t('reply_btn')}
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
