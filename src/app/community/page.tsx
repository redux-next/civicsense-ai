
"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type {
  ChangeEvent,
  FormEvent,
} from "react";

import {
  onAuthStateChanged,
  type User,
} from "firebase/auth";

import {
  ArrowBigDown,
  ArrowBigUp,
  Bell,
  Bookmark,
  Compass,
  Hash,
  Home,
  MessageCircle,
  MoreHorizontal,
  Plus,
  Search,
  Send,
  ShieldAlert,
  Sparkles,
  Users,
  X,
  Menu,
  LogOut,
  Moon,
  Sun,
  ImagePlus,
} from "lucide-react";

import { auth } from "@/lib/firebase/client";
import styles from "./civicspace.module.css";

type PostImage = {
  url: string;
  publicId: string;
};

type SelectedImage = {
  file: File;
  preview: string;
};

type Post = {
  id: string;
  title: string;
  content: string;
  category: string;
  anonymous: boolean;
  authorName: string;
  images: PostImage[];
  score: number;
  upvotes: number;
  downvotes: number;
  myVote: number;
  commentCount: number;
  createdAt: string | null;
};

type Comment = {
  id: string;
  content: string;
  authorName: string;
  createdAt: string | null;
};

const categories = [
  "general",
  "academics",
  "events",
  "hostel",
  "technology",
  "opportunities",
  "questions",
];

const MAX_IMAGES = 4;
const MAX_IMAGE_SIZE = 5 * 1024 * 1024;

const ALLOWED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
];

function label(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function timeAgo(value: string | null) {
  if (!value) return "Just now";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Just now";
  }

  const seconds = Math.max(
    0,
    Math.floor((Date.now() - date.getTime()) / 1000)
  );

  if (seconds < 60) return "Just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;

  return date.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
  });
}

export default function CivicSpacePage() {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [sort, setSort] = useState<"latest" | "popular">("latest");
  const [category, setCategory] = useState("all");
  const [search, setSearch] = useState("");

  const [composerOpen, setComposerOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [postCategory, setPostCategory] = useState("general");
  const [anonymous, setAnonymous] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [selectedImages, setSelectedImages] = useState<SelectedImage[]>([]);
  const [uploadingImages, setUploadingImages] = useState(false);

  const [previewImage, setPreviewImage] = useState<string | null>(null);

  // Track every object URL so it can be revoked on removal or unmount.
  const previewUrls = useRef<Set<string>>(new Set());

  const [voting, setVoting] = useState<string | null>(null);
  const [activeComments, setActiveComments] = useState<string | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentText, setCommentText] = useState("");
  const [commentLoading, setCommentLoading] = useState(false);

  const [reporting, setReporting] = useState<string | null>(null);
  const [reportReason, setReportReason] = useState("spam");
  const [mobileMenu, setMobileMenu] = useState(false);

  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [themeReady, setThemeReady] = useState(false);

  // Restore saved theme.
  useEffect(() => {
    try {
      const savedTheme = localStorage.getItem("civicspace-theme");

      if (savedTheme === "dark" || savedTheme === "light") {
        setTheme(savedTheme);
      }
    } catch {
      // Keep light mode.
    }

    setThemeReady(true);
  }, []);

  // Persist theme.
  useEffect(() => {
    if (!themeReady) return;

    try {
      localStorage.setItem("civicspace-theme", theme);
    } catch {
      // Theme remains active for this session.
    }
  }, [theme, themeReady]);

  const toggleTheme = () => {
    setTheme((current) =>
      current === "light" ? "dark" : "light"
    );
  };

  // Firebase authentication.
  useEffect(() => {
    return onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthLoading(false);
    });
  }, []);

  const getToken = useCallback(async () => {
    if (!user) {
      throw new Error("Please sign in first.");
    }

    return user.getIdToken();
  }, [user]);

  // Load community posts.
  const loadPosts = useCallback(async () => {
    if (!user) return;

    setLoading(true);
    setError("");

    try {
      const idToken = await getToken();

      const response = await fetch(
        `/api/civicspace/posts?sort=${sort}`,
        {
          headers: {
            Authorization: `Bearer ${idToken}`,
          },
          cache: "no-store",
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || "Unable to load discussions."
        );
      }

      setPosts(
        Array.isArray(data.posts)
          ? data.posts.map((post: Post) => ({
            ...post,
            images: Array.isArray(post.images)
              ? post.images
              : [],
          }))
          : []
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load posts."
      );
    } finally {
      setLoading(false);
    }
  }, [user, getToken, sort]);

  useEffect(() => {
    if (user) void loadPosts();
  }, [user, loadPosts]);

  // Revoke all temporary image URLs when the component unmounts.
  useEffect(() => {
    return () => {
      previewUrls.current.forEach((url) => {
        URL.revokeObjectURL(url);
      });

      previewUrls.current.clear();
    };
  }, []);

  // Close full-screen image preview with Escape.
  useEffect(() => {
    if (!previewImage) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setPreviewImage(null);
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [previewImage]);

  const filteredPosts = useMemo(() => {
    const query = search.trim().toLowerCase();

    return posts.filter((post) => {
      const matchesCategory =
        category === "all" || post.category === category;

      const matchesSearch =
        !query ||
        post.title.toLowerCase().includes(query) ||
        post.content.toLowerCase().includes(query);

      return matchesCategory && matchesSearch;
    });
  }, [posts, category, search]);

  // Select images for a new post.
  function selectImages(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);

    if (!files.length) return;

    const remaining = MAX_IMAGES - selectedImages.length;

    if (remaining <= 0) {
      setError("You can attach up to 4 images.");
      event.target.value = "";
      return;
    }

    const validImages: SelectedImage[] = [];

    for (const file of files.slice(0, remaining)) {
      if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
        setError("Only JPG, PNG and WebP images are supported.");
        continue;
      }

      if (file.size > MAX_IMAGE_SIZE) {
        setError(`${file.name} exceeds the 5 MB limit.`);
        continue;
      }

      const preview = URL.createObjectURL(file);
      previewUrls.current.add(preview);

      validImages.push({
        file,
        preview,
      });
    }

    setSelectedImages((previous) => [
      ...previous,
      ...validImages,
    ]);

    event.target.value = "";
  }

  function removeSelectedImage(index: number) {
    const image = selectedImages[index];

    if (image) {
      URL.revokeObjectURL(image.preview);
      previewUrls.current.delete(image.preview);
    }

    setSelectedImages((previous) =>
      previous.filter((_, i) => i !== index)
    );
  }

  // Upload selected images to Cloudinary.
  async function uploadSelectedImages(): Promise<PostImage[]> {
    if (!selectedImages.length) return [];

    setUploadingImages(true);

    try {
      const idToken = await getToken();
      const uploaded: PostImage[] = [];

      for (const image of selectedImages) {
        const signatureResponse = await fetch(
          "/api/civicspace/upload-signature",
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${idToken}`,
            },
          }
        );

        const signatureData = await signatureResponse.json();

        if (!signatureResponse.ok) {
          throw new Error(
            signatureData.error ||
            "Could not authorize image upload."
          );
        }

        const formData = new FormData();

        formData.append("file", image.file);
        formData.append("api_key", signatureData.apiKey);
        formData.append(
          "timestamp",
          String(signatureData.timestamp)
        );
        formData.append("folder", signatureData.folder);
        formData.append("public_id", signatureData.publicId);
        formData.append("signature", signatureData.signature);

        const uploadResponse = await fetch(
          `https://api.cloudinary.com/v1_1/${encodeURIComponent(
            signatureData.cloudName
          )}/image/upload`,
          {
            method: "POST",
            body: formData,
          }
        );

        const uploadData = await uploadResponse.json();

        if (!uploadResponse.ok) {
          throw new Error(
            uploadData.error?.message ||
            "Image upload failed."
          );
        }

        uploaded.push({
          url: uploadData.secure_url,
          publicId: uploadData.public_id,
        });
      }

      return uploaded;
    } finally {
      setUploadingImages(false);
    }
  }

  // Publish a post.
  async function createPost(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (submitting || uploadingImages) return;

    setSubmitting(true);
    setError("");

    try {
      const idToken = await getToken();
      const images = await uploadSelectedImages();

      const response = await fetch("/api/civicspace/posts", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${idToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title,
          content,
          category: postCategory,
          anonymous,
          images,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || "Could not publish post."
        );
      }

      // Revoke temporary previews after successful publishing.
      selectedImages.forEach((image) => {
        URL.revokeObjectURL(image.preview);
        previewUrls.current.delete(image.preview);
      });

      setSelectedImages([]);
      setTitle("");
      setContent("");
      setPostCategory("general");
      setAnonymous(false);
      setComposerOpen(false);
      setSort("latest");

      await loadPosts();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not publish post."
      );
    } finally {
      setSubmitting(false);
    }
  }

  // Vote on a post.
  async function vote(post: Post, value: 1 | -1) {
    if (voting) return;

    setVoting(post.id);

    try {
      const idToken = await getToken();

      const response = await fetch(
        `/api/civicspace/posts/${encodeURIComponent(post.id)}/vote`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${idToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ value }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Voting failed.");
      }

      setPosts((previous) =>
        previous.map((item) =>
          item.id === post.id
            ? {
              ...item,
              myVote: data.myVote,
              score: data.score,
              upvotes: data.upvotes,
              downvotes: data.downvotes,
            }
            : item
        )
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Voting failed."
      );
    } finally {
      setVoting(null);
    }
  }

  // Load comments without toggling the comments panel.
  async function loadComments(postId: string) {
    const idToken = await getToken();

    const response = await fetch(
      `/api/civicspace/posts/${encodeURIComponent(postId)}/comments`,
      {
        headers: {
          Authorization: `Bearer ${idToken}`,
        },
      }
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(
        data.error || "Unable to load comments."
      );
    }

    setComments(
      Array.isArray(data.comments) ? data.comments : []
    );
  }

  async function openComments(postId: string) {
    if (activeComments === postId) {
      setActiveComments(null);
      return;
    }

    setActiveComments(postId);
    setComments([]);

    try {
      await loadComments(postId);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load comments."
      );
    }
  }

  // Add a comment.
  async function addComment(postId: string) {
    if (!commentText.trim() || commentLoading) return;

    setCommentLoading(true);

    try {
      const idToken = await getToken();

      const response = await fetch(
        `/api/civicspace/posts/${encodeURIComponent(postId)}/comments`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${idToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            content: commentText,
            anonymous: false,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || "Unable to add comment."
        );
      }

      setCommentText("");
      setActiveComments(postId);

      await loadComments(postId);
      await loadPosts();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to comment."
      );
    } finally {
      setCommentLoading(false);
    }
  }

  // Report a post.
  async function reportPost(postId: string) {
    try {
      const idToken = await getToken();

      const response = await fetch(
        "/api/civicspace/reports",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${idToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            postId,
            reason: reportReason,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || "Unable to submit report."
        );
      }

      setReporting(null);
      setError("Your report has been submitted for review.");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to report."
      );
    }
  }

  if (authLoading) {
    return (
      <main className={styles.loading} data-theme={theme}>
        <div className={styles.loader} />
        <p>Entering CivicSpace...</p>
      </main>
    );
  }

  if (!user) {
    return (
      <main className={styles.authPage} data-theme={theme}>
        <div className={styles.authCard}>
          <div className={styles.brandIcon}>
            <Users size={28} />
          </div>

          <h1>Welcome to CivicSpace</h1>

          <p>
            A place for students to share ideas, ask questions
            and connect.
          </p>

          <a href="/login" className={styles.primaryButton}>
            Sign in to continue
          </a>

          <a href="/dashboard" className={styles.backLink}>
            Back to CivicSense
          </a>
        </div>
      </main>
    );
  }

  return (
    <main className={styles.app} data-theme={theme}>
      <header className={styles.topbar}>
        <a href="/community" className={styles.brand}>
          <span className={styles.brandIcon}>
            <Users size={22} />
          </span>

          <span className={styles.brandText}>
            Civic<span>Space</span>
            <small>STUDENT COMMUNITY</small>
          </span>
        </a>

        <div className={styles.topSearch}>
          <Search size={18} />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search discussions..."
          />
        </div>

        <div className={styles.topActions}>
          <a href="/dashboard" className={styles.dashboardLink}>
            CivicSense
          </a>

          <button
            type="button"
            className={styles.themeToggle}
            onClick={toggleTheme}
            aria-label={`Switch to ${theme === "light" ? "dark" : "light"
              } mode`}
          >
            {theme === "light" ? (
              <Moon size={19} />
            ) : (
              <Sun size={19} />
            )}
          </button>

          <button
            type="button"
            className={styles.iconButton}
            aria-label="Notifications"
          >
            <Bell size={19} />
          </button>

          <div className={styles.avatar}>
            {(user.displayName || user.email || "S")
              .charAt(0)
              .toUpperCase()}
          </div>

          <button
            type="button"
            className={styles.mobileMenuButton}
            onClick={() => setMobileMenu(!mobileMenu)}
            aria-label="Toggle menu"
          >
            {mobileMenu ? <X /> : <Menu />}
          </button>
        </div>
      </header>

      <div className={styles.layout}>
        <aside
          className={`${styles.sidebar} ${mobileMenu ? styles.sidebarOpen : ""
            }`}
        >
          <p className={styles.sideLabel}>MENU</p>

          <a href="/community" className={styles.navActive}>
            <Home size={18} /> Home
          </a>

          <button
            type="button"
            className={styles.navItem}
            onClick={() => setSort("latest")}
          >
            <Compass size={18} /> Latest
          </button>

          <button
            type="button"
            className={styles.navItem}
            onClick={() => setSort("popular")}
          >
            <Sparkles size={18} /> Popular
          </button>

          <button
            type="button"
            className={styles.navItem}
            onClick={() => setComposerOpen(true)}
          >
            <Plus size={18} /> Create post
          </button>

          <div className={styles.sideDivider} />

          <p className={styles.sideLabel}>EXPLORE TOPICS</p>

          <button
            type="button"
            className={
              category === "all"
                ? styles.topicActive
                : styles.topic
            }
            onClick={() => setCategory("all")}
          >
            <Hash size={16} /> All topics
          </button>

          {categories.map((item) => (
            <button
              type="button"
              key={item}
              className={
                category === item
                  ? styles.topicActive
                  : styles.topic
              }
              onClick={() => setCategory(item)}
            >
              <span className={styles.topicDot} />
              {label(item)}
            </button>
          ))}

          <div className={styles.sidebarBottom}>
            <a href="/community/priority">
              <ShieldAlert size={17} /> Campus Priority
            </a>

            <a href="/dashboard">
              <Home size={17} /> CivicSense dashboard
            </a>

            <button type="button" onClick={() => auth.signOut()}>
              <LogOut size={17} /> Sign out
            </button>
          </div>
        </aside>

        <section className={styles.feed}>
          <div className={styles.welcome}>
            <div className={styles.welcomeCopy}>
              <span className={styles.eyebrow}>
                <Sparkles size={14} /> THE STUDENT COMMUNITY
              </span>

              <h1>
                Your campus.
                <br />
                <span>Your conversations.</span>
              </h1>

              <p>
                Share your Ideas, questions, opportunities and everything
                in between.
              </p>

              <button
                type="button"
                className={styles.primaryButton}
                onClick={() => setComposerOpen(true)}
              >
                <Plus size={18} /> Start a discussion
              </button>
            </div>

            <div className={styles.welcomeArt}>
              <div className={styles.artOrb} />
              <div className={styles.artBubble}>
                <MessageCircle size={40} />
              </div>
              <div className={styles.artBubbleSmall}>
                <Users size={22} />
              </div>
            </div>
          </div>

          {error && (
            <div className={styles.notice}>
              <span>{error}</span>
              <button
                type="button"
                onClick={() => setError("")}
                aria-label="Dismiss"
              >
                <X size={17} />
              </button>
            </div>
          )}

          <div className={styles.feedHeading}>
            <div>
              <h2>Community feed</h2>
              <p>See what students are talking about.</p>
            </div>

            <div className={styles.sortControl}>
              <button
                type="button"
                className={sort === "latest" ? styles.sortActive : ""}
                onClick={() => setSort("latest")}
              >
                Latest
              </button>

              <button
                type="button"
                className={sort === "popular" ? styles.sortActive : ""}
                onClick={() => setSort("popular")}
              >
                Popular
              </button>
            </div>
          </div>

          {loading ? (
            <div className={styles.empty}>
              <div className={styles.loader} />
              Loading discussions...
            </div>
          ) : filteredPosts.length === 0 ? (
            <div className={styles.empty}>
              <div className={styles.emptyIcon}>
                <MessageCircle size={28} />
              </div>

              <h3>No discussions yet</h3>
              <p>Be the first to start a conversation.</p>

              <button
                type="button"
                className={styles.primaryButton}
                onClick={() => setComposerOpen(true)}
              >
                <Plus size={17} /> Create a post
              </button>
            </div>
          ) : (
            <div className={styles.postList}>
              {filteredPosts.map((post) => (
                <article
                  className={styles.postCard}
                  key={post.id}
                >
                  <div className={styles.postTop}>
                    <div className={styles.postAvatar}>
                      {post.anonymous
                        ? "?"
                        : post.authorName.charAt(0).toUpperCase()}
                    </div>

                    <div className={styles.postAuthor}>
                      <strong>{post.authorName}</strong>
                      <span>{timeAgo(post.createdAt)}</span>
                    </div>

                    <span className={styles.categoryBadge}>
                      {label(post.category)}
                    </span>

                    <button
                      type="button"
                      className={styles.moreButton}
                      onClick={() =>
                        setReporting(
                          reporting === post.id ? null : post.id
                        )
                      }
                      aria-label="Report post"
                    >
                      <MoreHorizontal size={20} />
                    </button>

                    {reporting === post.id && (
                      <div className={styles.reportMenu}>
                        <label>Report reason</label>

                        <select
                          value={reportReason}
                          onChange={(event) =>
                            setReportReason(event.target.value)
                          }
                        >
                          <option value="spam">Spam</option>
                          <option value="harassment">Harassment</option>
                          <option value="inappropriate">
                            Inappropriate
                          </option>
                          <option value="misinformation">
                            Misinformation
                          </option>
                          <option value="other">Other</option>
                        </select>

                        <button
                          type="button"
                          onClick={() => void reportPost(post.id)}
                        >
                          Submit report
                        </button>
                      </div>
                    )}
                  </div>

                  <h3 className={styles.postTitle}>
                    {post.title}
                  </h3>

                  <p className={styles.postContent}>
                    {post.content}
                  </p>

                  {post.images?.length > 0 && (
                    <div
                      className={`${styles.postImageGrid} ${post.images.length === 1
                          ? styles.singleImage
                          : ""
                        }`}
                    >
                      {post.images.map((image, index) => (
                        <button
                          type="button"
                          key={image.publicId || image.url}
                          className={styles.postImageButton}
                          onClick={() => setPreviewImage(image.url)}
                          aria-label={`View attached image ${index + 1}`}
                        >
                          <img
                            className={styles.postImage}
                            src={image.url}
                            alt={`Community post attachment ${index + 1}`}
                            loading="lazy"
                          />
                        </button>
                      ))}
                    </div>
                  )}

                  <div className={styles.postFooter}>
                    <div className={styles.voteGroup}>
                      <button
                        type="button"
                        className={
                          post.myVote === 1
                            ? styles.voteSelected
                            : styles.voteButton
                        }
                        disabled={voting === post.id}
                        onClick={() => void vote(post, 1)}
                        aria-label="Upvote"
                      >
                        <ArrowBigUp size={20} />
                      </button>

                      <strong>{post.score}</strong>

                      <button
                        type="button"
                        className={
                          post.myVote === -1
                            ? styles.voteDownSelected
                            : styles.voteButton
                        }
                        disabled={voting === post.id}
                        onClick={() => void vote(post, -1)}
                        aria-label="Downvote"
                      >
                        <ArrowBigDown size={20} />
                      </button>
                    </div>

                    <button
                      type="button"
                      className={styles.commentButton}
                      onClick={() => void openComments(post.id)}
                    >
                      <MessageCircle size={17} />
                      {post.commentCount} comments
                    </button>
                  </div>

                  {activeComments === post.id && (
                    <div className={styles.commentsPanel}>
                      <h4>Discussion</h4>

                      {comments.map((comment) => (
                        <div
                          className={styles.comment}
                          key={comment.id}
                        >
                          <div className={styles.commentAvatar}>
                            {comment.authorName.charAt(0)}
                          </div>

                          <div>
                            <strong>{comment.authorName}</strong>
                            <span>{timeAgo(comment.createdAt)}</span>
                            <p>{comment.content}</p>
                          </div>
                        </div>
                      ))}

                      {comments.length === 0 && (
                        <p className={styles.noComments}>
                          No comments yet. Start the conversation.
                        </p>
                      )}

                      <form
                        className={styles.commentComposer}
                        onSubmit={(event) => {
                          event.preventDefault();
                          void addComment(post.id);
                        }}
                      >
                        <input
                          value={commentText}
                          onChange={(event) =>
                            setCommentText(event.target.value)
                          }
                          placeholder="Write a comment..."
                          maxLength={1500}
                          required
                        />

                        <button
                          type="submit"
                          disabled={
                            !commentText.trim() || commentLoading
                          }
                        >
                          <Send size={17} />
                        </button>
                      </form>
                    </div>
                  )}
                </article>
              ))}
            </div>
          )}

          <footer className={styles.footer}>
            CivicSpace · A community built around student voices.
          </footer>
        </section>

        <aside className={styles.rightbar}>
          <div className={styles.rightCard}>
            <span className={styles.rightIcon}>
              <Users size={20} />
            </span>

            <h3>A space for every student.</h3>

            <p>
              Share what you know, ask what you don't, and learn
              from your campus community.
            </p>
          </div>

          <div className={styles.rightCard}>
            <h3>Community guidelines</h3>

            <ul>
              <li>Be respectful to everyone.</li>
              <li>Keep discussions constructive.</li>
              <li>Do not share private information.</li>
              <li>Report harmful content.</li>
            </ul>
          </div>

          <div className={styles.rightLinks}>
            <a href="/community/priority">Campus Priority</a>
            <a href="/dashboard">CivicSense dashboard</a>
            <span>© CivicSpace</span>
          </div>
        </aside>
      </div>

      {/* Create post modal */}
      {composerOpen && (
        <div
          className={styles.modalBackdrop}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setComposerOpen(false);
            }
          }}
        >
          <form
            className={styles.composerModal}
            onSubmit={createPost}
          >
            <div className={styles.modalHeader}>
              <div>
                <span className={styles.eyebrow}>
                  YOUR VOICE MATTERS
                </span>
                <h2>Create a discussion</h2>
              </div>

              <button
                type="button"
                className={styles.iconButton}
                onClick={() => setComposerOpen(false)}
                aria-label="Close composer"
              >
                <X />
              </button>
            </div>

            <label className={styles.fieldLabel}>Title</label>

            <input
              className={styles.field}
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Give your discussion a title"
              minLength={5}
              maxLength={140}
              required
            />

            <label className={styles.fieldLabel}>
              What's on your mind?
            </label>

            <textarea
              className={styles.textarea}
              value={content}
              onChange={(event) => setContent(event.target.value)}
              placeholder="Share your thoughts with the community..."
              minLength={10}
              maxLength={5000}
              rows={6}
              required
            />

            <label className={styles.fieldLabel}>
              Choose a topic
            </label>

            <select
              className={styles.field}
              value={postCategory}
              onChange={(event) =>
                setPostCategory(event.target.value)
              }
            >
              {categories.map((item) => (
                <option key={item} value={item}>
                  {label(item)}
                </option>
              ))}
            </select>

            {/* Image upload */}
            <div className={styles.imageUploadSection}>
              <label className={styles.fieldLabel}>
                Attach images ({selectedImages.length}/{MAX_IMAGES})
              </label>

              {selectedImages.length < MAX_IMAGES && (
                <label className={styles.imageUploadBox}>
                  <ImagePlus size={26} />
                  <strong>Add images</strong>
                  <span>
                    JPG, PNG or WebP · Maximum 5 MB each
                  </span>

                  <input
                    className={styles.imageUploadInput}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    multiple
                    onChange={selectImages}
                  />
                </label>
              )}

              {selectedImages.length > 0 && (
                <div className={styles.imagePreviewGrid}>
                  {selectedImages.map((image, index) => (
                    <div
                      className={styles.imagePreviewItem}
                      key={image.preview}
                    >
                      <button
                        type="button"
                        className={styles.previewImageButton}
                        onClick={() => setPreviewImage(image.preview)}
                        aria-label={`Preview selected image ${index + 1}`}
                      >
                        <img
                          src={image.preview}
                          alt={`Selected image ${index + 1}`}
                        />
                      </button>

                      <button
                        type="button"
                        className={styles.removeImageButton}
                        onClick={() => removeSelectedImage(index)}
                        aria-label={`Remove image ${index + 1}`}
                      >
                        <X size={15} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {uploadingImages && (
                <p className={styles.uploadProgress}>
                  Uploading images to Cloudinary...
                </p>
              )}
            </div>

            <label className={styles.anonymousToggle}>
              <input
                type="checkbox"
                checked={anonymous}
                onChange={(event) =>
                  setAnonymous(event.target.checked)
                }
              />
              Post anonymously
            </label>

            <p className={styles.privacyNote}>
              Your account remains privately associated with the
              post for moderation and safety.
            </p>

            <div className={styles.modalActions}>
              <button
                type="button"
                className={styles.cancelButton}
                onClick={() => setComposerOpen(false)}
              >
                Cancel
              </button>

              <button
                type="submit"
                className={styles.primaryButton}
                disabled={submitting || uploadingImages}
              >
                {uploadingImages
                  ? "Uploading images..."
                  : submitting
                    ? "Publishing..."
                    : "Publish discussion"}

                <Send size={16} />
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Full-screen image preview */}
      {previewImage && (
        <div
          className={styles.imagePreviewModal}
          role="dialog"
          aria-modal="true"
          aria-label="Image preview"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setPreviewImage(null);
            }
          }}
        >
          <button
            type="button"
            className={styles.closeImagePreview}
            onClick={() => setPreviewImage(null)}
            aria-label="Close image preview"
          >
            <X size={24} />
          </button>

          <img
            src={previewImage}
            alt="Full-size community image"
          />
        </div>
      )}
    </main>
  );
}
