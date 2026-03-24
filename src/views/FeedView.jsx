// ─── FeedView ─────────────────────────────────────────────────────────────────
// Social feed: create posts (optionally with an image URL), view and add
// per-post comments.  Authors and admins may delete their own content.

import React, { useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { t } from '../strings.js';
import { toEmbedUrl, tsToDate } from '../utils.js';
import ModalOverlay from '../components/ModalOverlay.jsx';
import SafeImage from '../components/ui/SafeImage.jsx';
import { SafeProfileImage, Button, Input, Textarea } from '../components/ui/index.js';
import { Card } from '../components/layout/index.js';

const MAX_VISIBLE_POST_IMAGES = 5;
const REACTION_TYPES = [
  { id: 'like', emoji: '👍', label: 'Like' },
  { id: 'love', emoji: '❤️', label: 'Love' },
  { id: 'fire', emoji: '🔥', label: 'Fire' },
];

function getLiveMemberName(memberships, { userId = null, fallback = 'Member' } = {}) {
  const membership = memberships.find((entry) => entry.userId === userId);
  return String(membership?.displayName || fallback || 'Member').trim() || 'Member';
}

function ReactionPopover({ memberships, reactionsByType }) {
  const sections = REACTION_TYPES
    .map((reactionType) => {
      const entries = reactionsByType[reactionType.id] || [];
      if (!entries.length) return null;
      return {
        ...reactionType,
        names: entries.map((entry) => getLiveMemberName(memberships, {
          userId: entry.userId,
          fallback: entry.authorName || 'Member',
        })),
      };
    })
    .filter(Boolean);

  if (!sections.length) return null;

  return (
    <div className="pointer-events-none absolute bottom-full left-0 z-20 mb-3 hidden min-w-[13rem] rounded-2xl border border-slate-700/90 bg-slate-950 px-3 py-2.5 text-xs shadow-[0_18px_40px_rgba(0,0,0,0.45)] ring-1 ring-black/40 backdrop-blur-sm group-hover:block group-focus-within:block">
      <div className="absolute left-5 top-full h-3 w-3 -translate-y-1/2 rotate-45 border-b border-r border-slate-700/90 bg-slate-950" />
      <div className="space-y-2">
        {sections.map((section) => (
          <div key={section.id}>
            <div className="mb-1 flex items-center gap-1.5 font-semibold text-slate-100">
              <span aria-hidden="true">{section.emoji}</span>
              <span>{section.label}</span>
            </div>
            <div className="text-slate-300">
              {section.names.join(', ')}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function parseComposerMediaUrls(value) {
  return value
    .split(/\r?\n|,/)
    .map((url) => url.trim())
    .filter(Boolean);
}

function isHostedVideoUrl(url) {
  return /\.(mp4|webm|ogg|mov|m4v)(?:$|[?#])/i.test(url || '');
}

function isEmbeddedVideoUrl(url) {
  const lower = String(url || '').toLowerCase();
  return (
    lower.includes('youtube.com/') ||
    lower.includes('youtu.be/') ||
    lower.includes('vimeo.com/') ||
    lower.includes('/embed/') ||
    lower.includes('player.vimeo.com/')
  );
}

function splitMediaUrls(urls) {
  const images = [];
  const videos = [];

  urls.forEach((url) => {
    if (isHostedVideoUrl(url) || isEmbeddedVideoUrl(url)) videos.push(url);
    else images.push(url);
  });

  return { images, videos };
}

function getMediaItem(url) {
  return {
    url,
    type: isHostedVideoUrl(url) || isEmbeddedVideoUrl(url) ? 'video' : 'image',
  };
}

function getPostMediaUrls(post) {
  const imageUrls = Array.isArray(post.imageUrls) ? post.imageUrls : [];
  const normalized = imageUrls
    .map((url) => String(url || '').trim())
    .filter(Boolean);

  if (normalized.length > 0) return normalized;
  return post.imageUrl ? [post.imageUrl] : [];
}

function FeedGalleryModal({ mediaItems, activeIndex, onClose, onNavigate }) {
  useEffect(() => {
    if (!mediaItems.length) return undefined;

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') onClose();
      if (event.key === 'ArrowLeft') onNavigate(-1);
      if (event.key === 'ArrowRight') onNavigate(1);
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [mediaItems.length, onClose, onNavigate]);

  if (!mediaItems.length) return null;

  const activeItem = mediaItems[activeIndex];

  return (
    <ModalOverlay onClickBackdrop={onClose} className="z-[70] p-3 sm:p-6">
      <div className="relative w-[min(92vw,1100px)] rounded-3xl bg-slate-950/95 p-3 sm:p-4">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 z-10 rounded-full bg-black/50 p-2 text-white transition hover:bg-black/70"
          aria-label={t('close') || 'Close'}
        >
          <X className="h-5 w-5" />
        </button>

        {mediaItems.length > 1 && (
          <>
            <button
              type="button"
              onClick={() => onNavigate(-1)}
              className="absolute left-3 top-1/2 z-10 -translate-y-1/2 rounded-full bg-black/55 p-2 text-white transition hover:bg-black/75"
              aria-label="Previous image"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={() => onNavigate(1)}
              className="absolute right-3 top-1/2 z-10 -translate-y-1/2 rounded-full bg-black/55 p-2 text-white transition hover:bg-black/75"
              aria-label="Next image"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </>
        )}

        <div className="overflow-hidden rounded-2xl bg-black">
          {activeItem?.type === 'video' ? (
            isEmbeddedVideoUrl(activeItem.url) ? (
              <div className="relative w-[min(92vw,1100px)]" style={{ paddingTop: '56.25%' }}>
                <iframe
                  src={toEmbedUrl(activeItem.url)}
                  className="absolute inset-0 h-full w-full"
                  allowFullScreen
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  title={`feed-modal-video-${activeIndex}`}
                />
              </div>
            ) : (
              <video
                src={activeItem.url}
                controls
                autoPlay
                preload="metadata"
                className="max-h-[82vh] w-full bg-black"
              />
            )
          ) : (
            <SafeImage
              src={activeItem?.url}
              alt=""
              className="max-h-[82vh] w-full object-contain"
              fallbackClass="flex h-[60vh] w-[min(92vw,1100px)] items-center justify-center"
            />
          )}
        </div>

        <div className="mt-3 flex items-center justify-between gap-3 text-xs text-slate-300">
          <span>{activeIndex + 1} / {mediaItems.length}</span>
          <span>Usa las flechas del teclado para navegar</span>
        </div>
      </div>
    </ModalOverlay>
  );
}

function FeedGalleryTile({ item, onClick, overlay = null, className = '' }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative h-full w-full overflow-hidden bg-slate-900 text-left ${className}`.trim()}
    >
      {item.type === 'video' ? (
        <>
          <div className="flex h-full w-full items-center justify-center bg-black">
            {isEmbeddedVideoUrl(item.url) ? (
              <iframe
                src={toEmbedUrl(item.url)}
                className="h-full w-full pointer-events-none"
                title={`feed-tile-video-${item.url}`}
                tabIndex={-1}
              />
            ) : (
              <video
                src={item.url}
                muted
                playsInline
                preload="metadata"
                className="h-full w-full object-cover"
              />
            )}
          </div>
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/20">
            <div className="rounded-full bg-black/60 px-3 py-1 text-xs font-semibold text-white">Video</div>
          </div>
        </>
      ) : (
        <SafeImage
          src={item.url}
          alt=""
          className="h-full w-full object-cover transition duration-200 hover:scale-[1.02]"
          fallbackClass="h-full w-full"
        />
      )}
      {overlay}
    </button>
  );
}

function FeedMediaGallery({ mediaItems, className = '', onOpenItem }) {
  const visibleItems = mediaItems.slice(0, MAX_VISIBLE_POST_IMAGES);
  const hiddenCount = Math.max(mediaItems.length - visibleItems.length, 0);

  if (visibleItems.length === 0) return null;

  const layoutCount = visibleItems.length;
  const openItem = (index) => onOpenItem?.(index);
  const getOverlay = (index) => (
    hiddenCount > 0 && index === visibleItems.length - 1
      ? <div className="absolute inset-0 flex items-center justify-center bg-black/55 text-2xl font-semibold text-white">+{hiddenCount}</div>
      : null
  );

  if (layoutCount === 1) {
    return (
      <div className={`mt-3 overflow-hidden rounded-2xl bg-slate-950 ${className}`.trim()}>
        <div className="aspect-[16/10]">
          <FeedGalleryTile item={visibleItems[0]} onClick={() => openItem(0)} />
        </div>
      </div>
    );
  }

  if (layoutCount === 2) {
    return (
      <div className={`mt-3 overflow-hidden rounded-2xl bg-slate-950 ${className}`.trim()}>
        <div className="grid h-[18rem] grid-cols-2 gap-1 sm:h-[22rem]">
          {visibleItems.map((item, index) => (
            <FeedGalleryTile key={`${item.url}-${index}`} item={item} onClick={() => openItem(index)} />
          ))}
        </div>
      </div>
    );
  }

  if (layoutCount === 3) {
    return (
      <div className={`mt-3 overflow-hidden rounded-2xl bg-slate-950 ${className}`.trim()}>
        <div className="grid h-[22rem] grid-cols-2 gap-1 sm:h-[28rem]">
          <FeedGalleryTile item={visibleItems[0]} onClick={() => openItem(0)} />
          <div className="grid grid-rows-2 gap-1">
            <FeedGalleryTile item={visibleItems[1]} onClick={() => openItem(1)} />
            <FeedGalleryTile item={visibleItems[2]} onClick={() => openItem(2)} />
          </div>
        </div>
      </div>
    );
  }

  if (layoutCount === 4) {
    return (
      <div className={`mt-3 overflow-hidden rounded-2xl bg-slate-950 ${className}`.trim()}>
        <div className="grid h-[22rem] grid-cols-2 grid-rows-2 gap-1 sm:h-[28rem]">
          {visibleItems.map((item, index) => (
            <FeedGalleryTile key={`${item.url}-${index}`} item={item} onClick={() => openItem(index)} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={`mt-3 overflow-hidden rounded-2xl bg-slate-950 ${className}`.trim()}>
      <div className="grid h-[22rem] grid-rows-2 gap-1 sm:h-[28rem]">
        <div className="grid grid-cols-2 gap-1">
          {visibleItems.slice(0, 2).map((item, index) => (
            <FeedGalleryTile key={`${item.url}-${index}`} item={item} onClick={() => openItem(index)} />
          ))}
        </div>
        <div className="grid grid-cols-3 gap-1">
          {visibleItems.slice(2).map((item, offset) => {
            const index = offset + 2;
            return (
              <FeedGalleryTile
                key={`${item.url}-${index}`}
                item={item}
                onClick={() => openItem(index)}
                overlay={getOverlay(index)}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}

function FeedVideoGallery({ videos, className = '' }) {
  if (!videos.length) return null;

  return (
    <div className={`mt-3 space-y-3 ${className}`.trim()}>
      {videos.map((videoUrl, index) => (
        <div key={`${videoUrl}-${index}`} className="overflow-hidden rounded-2xl bg-slate-950">
          {isEmbeddedVideoUrl(videoUrl) ? (
            <div className="relative w-full" style={{ paddingTop: '56.25%' }}>
              <iframe
                src={toEmbedUrl(videoUrl)}
                className="absolute inset-0 h-full w-full"
                allowFullScreen
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                title={`feed-video-${index}`}
              />
            </div>
          ) : (
            <video
              src={videoUrl}
              controls
              preload="metadata"
              className="max-h-[32rem] w-full bg-black"
            />
          )}
        </div>
      ))}
    </div>
  );
}

/**
 * @param {{
 *   posts:            object[],
 *   comments:         object[],
 *   reactions:        object[],
 *   authUser:         object | null,
 *   canEdit:          boolean,
 *   memberships:      object[],
 *   onCreatePost:     function(content: string, mediaUrls: string[]): Promise<void>,
 *   onDeletePost:     function(id: string): Promise<void>,
 *   onCreateComment:  function(postId: string, text: string): Promise<void>,
 *   onDeleteComment:  function(id: string): Promise<void>,
 *   onToggleReaction: function(postId: string, type: string): Promise<void>,
 *   onViewProfile:    function(membership: object): void,
 * }} props
 */
export default function FeedView({
  posts, comments, reactions, authUser, canEdit, memberships,
  onCreatePost, onDeletePost, onCreateComment, onDeleteComment, onToggleReaction, onViewProfile,
}) {
  const [newContent,     setNewContent]     = useState('');
  const [newImageUrls,   setNewImageUrls]   = useState('');
  const [showImageField, setShowImageField] = useState(false);
  const [expandedPostId, setExpandedPostId] = useState(null);
  const [commentDrafts,  setCommentDrafts]  = useState({});
  const [galleryState,   setGalleryState]   = useState({ items: [], index: 0 });
  const composerMediaUrls = useMemo(
    () => parseComposerMediaUrls(newImageUrls),
    [newImageUrls],
  );
  const composerMediaItems = useMemo(
    () => composerMediaUrls.map(getMediaItem),
    [composerMediaUrls],
  );

  // ── Post / comment handlers ────────────────────────────────────────────────

  const handlePost = async () => {
    if (!newContent.trim()) return;
    await onCreatePost(newContent.trim(), composerMediaUrls);
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

  const openGallery = (items, index) => {
    if (!items.length) return;
    setGalleryState({ items, index });
  };

  const closeGallery = () => setGalleryState({ items: [], index: 0 });

  const navigateGallery = (direction) => {
    setGalleryState((current) => {
      if (!current.items.length) return current;
      const nextIndex = (current.index + direction + current.items.length) % current.items.length;
      return { ...current, index: nextIndex };
    });
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="w-full max-w-none space-y-6 lg:max-w-2xl">
      <div className="animate-fade-in">
        <h2 className="text-2xl font-bold text-gradient tracking-tight">Feed</h2>
        <p className="text-sm text-content-secondary mt-1">{t('feed_desc') || 'Actividad del equipo'}</p>
      </div>

      {/* Post composer */}
      <Card variant="glass" className="space-y-3 animate-slide-up animate-delay-1">
        <Textarea rows={3} value={newContent} onChange={(e) => setNewContent(e.target.value)}
          placeholder={t('share_ph')} />
        {showImageField && (
          <Textarea rows={3} value={newImageUrls} onChange={(e) => setNewImageUrls(e.target.value)}
            placeholder={t('paste_img_ph')}
            className="text-xs" />
        )}
        <FeedMediaGallery mediaItems={composerMediaItems} onOpenItem={(index) => openGallery(composerMediaItems, index)} />
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
      {posts.map((post, postIndex) => {
        const postComments = comments
          .filter((c) => c.postId === post.id)
          .sort((a, b) => tsToDate(a.createdAt) - tsToDate(b.createdAt));
        const isExpanded = expandedPostId === post.id;
        const isOwn      = post.authorId === authUser?.uid;
        const authorMembership = memberships.find((m) => m.userId === post.authorId);
        const authorPhoto = authorMembership?.photoURL || post.authorPhoto;
        const authorName = getLiveMemberName(memberships, { userId: post.authorId, fallback: post.authorName || 'Member' });
        const postMediaItems = getPostMediaUrls(post).map(getMediaItem);
        const postReactions = reactions.filter((reaction) => reaction.postId === post.id);
        const myReaction = postReactions.find((reaction) => reaction.userId === authUser?.uid)?.type || null;
        const reactionCounts = postReactions.reduce((acc, reaction) => {
          acc[reaction.type] = (acc[reaction.type] || 0) + 1;
          return acc;
        }, {});
        const reactionsByType = postReactions.reduce((acc, reaction) => {
          if (!acc[reaction.type]) acc[reaction.type] = [];
          acc[reaction.type].push(reaction);
          return acc;
        }, {});

        return (
          <Card
            key={post.id}
            className="overflow-hidden hover:border-primary/25 hover:shadow-glow-sm hover:-translate-y-0.5 animate-slide-up"
            style={{ animationDelay: `${Math.min(postIndex * 60, 360)}ms` }}
          >
            {/* Post body */}
            <div className="flex items-start gap-3 p-4">
              {authorPhoto ? (
                <SafeProfileImage
                  src={authorPhoto}
                  fallback={<div className="w-9 h-9 rounded-full bg-primary/20 border border-primary/30 shrink-0 flex items-center justify-center text-sm font-bold text-primary">{(authorName || '?')[0].toUpperCase()}</div>}
                  className="w-9 h-9 rounded-full shrink-0 ring-2 ring-primary/30 ring-offset-1 ring-offset-surface-raised"
                  alt=""
                />
              ) : (
                <div className="w-9 h-9 rounded-full bg-primary/20 border border-primary/30 shrink-0 flex items-center justify-center text-sm font-bold text-primary ring-2 ring-primary/20 ring-offset-1 ring-offset-surface-raised">
                  {(authorName || '?')[0].toUpperCase()}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2 flex-wrap">
                  <button
                    onClick={() => { const m = memberships.find((mb) => mb.userId === post.authorId); if (m) onViewProfile?.(m); }}
                    className="text-sm font-semibold hover:underline">
                    {authorName}
                  </button>
                  <span className="text-[11px] text-slate-400">{tsToDate(post.createdAt).toLocaleString()}</span>
                </div>
                <p className="text-sm text-slate-200 mt-1.5 whitespace-pre-wrap leading-relaxed">{post.content}</p>
                <FeedMediaGallery mediaItems={postMediaItems} onOpenItem={(index) => openGallery(postMediaItems, index)} />
                <div className="group relative mt-3 inline-flex items-center overflow-visible rounded-full border border-slate-700 bg-slate-900/80">
                  {REACTION_TYPES.map(({ id, emoji, label }, index) => {
                    const isActive = myReaction === id;
                    const count = reactionCounts[id] || 0;
                    return (
                      <button
                        key={id}
                        type="button"
                        onClick={() => onToggleReaction?.(post.id, id)}
                        className={[
                          'inline-flex items-center gap-1.5 px-3 py-1.5 text-xs transition-all duration-150 hover:scale-110 active:scale-95',
                          index > 0 ? 'border-l border-slate-700' : '',
                          isActive
                            ? 'bg-primary/15 text-primary'
                            : 'text-slate-300 hover:bg-slate-800/80 hover:text-slate-100',
                        ].join(' ')}
                        title={label}
                        aria-label={label}
                      >
                        <span className="text-base leading-none" aria-hidden="true">{emoji}</span>
                        <span className="min-w-[0.75rem] text-[11px] opacity-80">{count}</span>
                      </button>
                    );
                  })}
                  <ReactionPopover memberships={memberships} reactionsByType={reactionsByType} />
                </div>
              </div>
              {(canEdit || isOwn) && (
                <Button variant="link" size="sm" onClick={() => onDeletePost(post.id)} className="shrink-0 text-error hover:text-red-400">
                  {t('delete')}
                </Button>
              )}
            </div>

            {/* Comment toggle */}
            <div className="border-t border-slate-700/60 px-4 py-2">
              <button onClick={() => setExpandedPostId(isExpanded ? null : post.id)}
                className="inline-flex items-center gap-1.5 text-xs text-content-tertiary hover:text-content-primary transition-colors">
                <span>
                  {postComments.length > 0
                    ? `${postComments.length} comentario${postComments.length !== 1 ? 's' : ''}`
                    : t('add_a_comment_btn')
                  }
                </span>
                <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} strokeWidth={2} />
              </button>
            </div>

            {/* Comment thread */}
            {isExpanded && (
              <div className="border-t border-slate-700/60 bg-surface-sunken/30 px-4 pb-4 pt-3 space-y-3">
                {postComments.map((c) => (
                  <div key={c.id} className="flex items-start gap-2 animate-slide-up">
                    {(() => {
                      const commentAuthorName = getLiveMemberName(memberships, { userId: c.authorId, fallback: c.authorName || 'Member' });
                      return (
                        <>
                    <div className="w-7 h-7 rounded-full bg-primary/20 border border-primary/30 shrink-0 flex items-center justify-center text-xs font-bold text-primary">
                      {(commentAuthorName || '?')[0].toUpperCase()}
                    </div>
                    <div className="flex-1 bg-surface-overlay/60 border border-slate-700/40 rounded-lg px-3 py-2">
                      <div className="flex items-baseline gap-2">
                        <span className="text-xs font-semibold text-content-primary">{commentAuthorName}</span>
                        <span className="text-[10px] text-content-tertiary">{tsToDate(c.createdAt).toLocaleString()}</span>
                      </div>
                      <p className="text-xs text-content-secondary mt-0.5">{c.content}</p>
                    </div>
                    {(canEdit || c.authorId === authUser?.uid) && (
                      <button onClick={() => onDeleteComment(c.id)} className="text-error hover:text-red-400 shrink-0 mt-1 p-0.5 transition-colors" title={t('delete')} aria-label={t('delete')}><X className="w-4 h-4" strokeWidth={2} /></button>
                    )}
                        </>
                      );
                    })()}
                  </div>
                ))}
                <div className="flex gap-2 mt-1">
                  <Input
                    value={commentDrafts[post.id] || ''}
                    onChange={(e) => setCommentDrafts((d) => ({ ...d, [post.id]: e.target.value }))}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleComment(post.id); }}
                    placeholder={t('write_comment_ph')}
                    className="flex-1 text-xs py-1.5"
                  />
                  <Button variant="secondary" size="sm" onClick={() => handleComment(post.id)}>
                    {t('reply_btn')}
                  </Button>
                </div>
              </div>
            )}
          </Card>
        );
      })}

      {galleryState.items.length > 0 && (
        <FeedGalleryModal
          mediaItems={galleryState.items}
          activeIndex={galleryState.index}
          onClose={closeGallery}
          onNavigate={navigateGallery}
        />
      )}
    </div>
  );
}
