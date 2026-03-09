// ─── FeedView ─────────────────────────────────────────────────────────────────
// Social feed: create posts (optionally with an image URL), view and add
// per-post comments.  Authors and admins may delete their own content.

import React, { useState } from 'react';
import { X } from 'lucide-react';
import { t } from '../strings.js';
import { tsToDate } from '../utils.js';
import { SafeProfileImage, Button, Textarea, Input } from '../components/ui/index.js';
import { Card } from '../components/layout/index.js';

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
    <div className="space-y-6 max-w-2xl">
      <h2 className="text-lg font-semibold text-content-primary">Feed</h2>

      {/* Post composer */}
      <Card className="space-y-3">
        <Textarea rows={3} value={newContent} onChange={(e) => setNewContent(e.target.value)}
          placeholder={t('share_ph')} />
        {showImageField && (
          <Input value={newImageUrl} onChange={(e) => setNewImageUrl(e.target.value)}
            placeholder={t('paste_img_ph')}
            className="text-xs" />
        )}
        {newImageUrl && (
          <img src={newImageUrl} alt="preview" className="rounded-lg max-h-48 object-contain bg-surface-sunken w-full" />
        )}
        <div className="flex items-center justify-between pt-1">
          <Button variant="ghost" size="sm" onClick={() => setShowImageField((s) => !s)}>
            {showImageField ? t('remove_image_btn') : t('add_image_btn')}
          </Button>
          <Button variant="primary" size="sm" onClick={handlePost} disabled={!newContent.trim()}>
            {t('post')}
          </Button>
        </div>
      </Card>

      {posts.length === 0 && (
        <div className="text-center text-xs text-slate-500 py-10">{t('feed_no_posts_guidance')}</div>
      )}

      {/* Post list */}
      {posts.map((post) => {
        const postComments = comments
          .filter((c) => c.postId === post.id)
          .sort((a, b) => tsToDate(a.createdAt) - tsToDate(b.createdAt));
        const isExpanded = expandedPostId === post.id;
        const isOwn      = post.authorId === authUser?.uid;
        const authorMembership = memberships.find((m) => m.userId === post.authorId);
        const authorPhoto = authorMembership?.photoURL || post.authorPhoto;

        return (
          <Card key={post.id} hover className="overflow-hidden">
            {/* Post body */}
            <div className="flex items-start gap-3 p-4">
              {authorPhoto ? (
                <SafeProfileImage
                  src={authorPhoto}
                  fallback={<div className="w-9 h-9 rounded-full bg-slate-600 shrink-0 flex items-center justify-center text-sm font-bold">{(post.authorName || '?')[0].toUpperCase()}</div>}
                  className="w-9 h-9 rounded-full shrink-0"
                  alt=""
                />
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
                <Button variant="link" size="sm" onClick={() => onDeletePost(post.id)} className="shrink-0 text-error hover:text-red-400">
                  {t('delete')}
                </Button>
              )}
            </div>

            {/* Comment toggle */}
            <div className="border-t border-slate-700 px-4 py-2">
              <button onClick={() => setExpandedPostId(isExpanded ? null : post.id)}
                className="text-xs text-slate-400 hover:text-slate-200 transition-colors">
                {postComments.length > 0
                  ? `${postComments.length} comentario${postComments.length !== 1 ? 's' : ''}`
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
                      <button onClick={() => onDeleteComment(c.id)} className="text-red-400 hover:text-red-300 shrink-0 mt-1 p-0.5" title={t('delete')} aria-label={t('delete')}><X className="w-4 h-4" strokeWidth={2} /></button>
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
          </Card>
        );
      })}
    </div>
  );
}
