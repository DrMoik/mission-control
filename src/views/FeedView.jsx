// ─── FeedView ─────────────────────────────────────────────────────────────────
// Social feed: create posts (optionally with an image URL), view and add
// per-post comments.  Authors and admins may delete their own content.

import React, { useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { t } from '../strings.js';
import { tsToDate } from '../utils.js';
import SafeImage from '../components/ui/SafeImage.jsx';
import { SafeProfileImage, Button, Textarea } from '../components/ui/index.js';
import { Card } from '../components/layout/index.js';

const MAX_VISIBLE_POST_IMAGES = 5;

function getPostImages(post) {
  const imageUrls = Array.isArray(post.imageUrls) ? post.imageUrls : [];
  const normalized = imageUrls
    .map((url) => String(url || '').trim())
    .filter(Boolean);

  if (normalized.length > 0) return normalized;
  return post.imageUrl ? [post.imageUrl] : [];
}

function getGalleryLayoutClass(imageCount) {
  if (imageCount <= 1) return 'grid-cols-1';
  if (imageCount === 2) return 'grid-cols-2';
  if (imageCount === 3) return 'grid-cols-2 grid-rows-2';
  if (imageCount === 4) return 'grid-cols-2 grid-rows-2';
  return 'grid-cols-6 grid-rows-2';
}

function getGalleryItemClass(imageCount, index) {
  if (imageCount === 1) return 'col-span-1 row-span-1 aspect-[16/10]';
  if (imageCount === 2) return 'col-span-1 row-span-1 aspect-square';
  if (imageCount === 3) {
    if (index === 0) return 'row-span-2 aspect-[4/5]';
    return 'aspect-square';
  }
  if (imageCount === 4) return 'col-span-1 row-span-1 aspect-square';
  if (index < 2) return 'col-span-3 aspect-[4/3]';
  return 'col-span-2 aspect-square';
}

function FeedImageGallery({ images, className = '' }) {
  const visibleImages = images.slice(0, MAX_VISIBLE_POST_IMAGES);
  const hiddenCount = Math.max(images.length - visibleImages.length, 0);

  if (visibleImages.length === 0) return null;

  const layoutCount = visibleImages.length;

  return (
    <div className={`mt-3 overflow-hidden rounded-2xl bg-slate-950 ${className}`.trim()}>
      <div className={`grid gap-1 ${getGalleryLayoutClass(layoutCount)}`}>
        {visibleImages.map((imageUrl, index) => {
          const showOverflow = hiddenCount > 0 && index === visibleImages.length - 1;

          return (
            <div
              key={`${imageUrl}-${index}`}
              className={`relative overflow-hidden bg-slate-900 ${getGalleryItemClass(layoutCount, index)}`}
            >
              <SafeImage
                src={imageUrl}
                alt=""
                className="h-full w-full object-cover"
                fallbackClass="h-full w-full"
              />
              {showOverflow && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/55 text-2xl font-semibold text-white">
                  +{hiddenCount}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * @param {{
 *   posts:            object[],
 *   comments:         object[],
 *   authUser:         object | null,
 *   canEdit:          boolean,
 *   memberships:      object[],
 *   onCreatePost:     function(content: string, imageUrls: string[]): Promise<void>,
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
  const [newImageUrls,   setNewImageUrls]   = useState('');
  const [showImageField, setShowImageField] = useState(false);
  const [expandedPostId, setExpandedPostId] = useState(null);
  const [commentDrafts,  setCommentDrafts]  = useState({});
  const composerImages = useMemo(
    () => newImageUrls
      .split(/\r?\n|,/)
      .map((url) => url.trim())
      .filter(Boolean),
    [newImageUrls],
  );

  // ── Post / comment handlers ────────────────────────────────────────────────

  const handlePost = async () => {
    if (!newContent.trim()) return;
    await onCreatePost(newContent.trim(), composerImages);
    setNewContent('');
    setNewImageUrls('');
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
          <Textarea rows={3} value={newImageUrls} onChange={(e) => setNewImageUrls(e.target.value)}
            placeholder={t('paste_img_ph')}
            className="text-xs" />
        )}
        {composerImages.length > 0 && (
          <FeedImageGallery images={composerImages} />
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
        const postImages = getPostImages(post);

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
                <FeedImageGallery images={postImages} />
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
