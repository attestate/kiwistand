// This is mock data for the story object, based on the usage in row.mjs

export const mockStory = {
  index: "12345",
  href: "https://example.com/article-title",
  title: "Example Article Title",
  metadata: {
    compliantTitle: "Example Article Title",
    image: "https://placehold.co/600x300",
    ogDescription: "This is a description of the example article.",
    twitterAuthorAvatar: "https://placehold.co/48x48",
    twitterCreator: "@testuser",
    farcasterCast: {
      author: {
        pfp: "https://placehold.co/48x48",
        username: "testuser.eth",
      },
      text: "This is a test farcaster cast.",
      embeds: [{ url: "https://placehold.co/600x338" }],
      hash: "0x1234567890abcdef",
    },
    canIframe: true,
  },
  timestamp: Date.now() / 1000 - 3600, // 1 hour ago
  identity: "0x1234567890123456789012345678901234567890",
  displayName: "testuser.eth",
  upvoters: ["0x1", "0x2", "0x3"],
  isOriginal: true,
  storyEarnings: 123.45,
  avatars: [
    "https://placehold.co/24x24",
    "https://placehold.co/24x24",
    "https://placehold.co/24x24",
    "https://placehold.co/24x24",
    "https://placehold.co/24x24",
  ],
  lastComment: {
    index: "67890",
    identity: {
      ens: "commenter.eth",
      farcaster: "commenter",
      lens: "commenter.lens",
      safeAvatar: "https://placehold.co/64x64",
      displayName: "commenter.eth",
    },
    timestamp: Date.now() / 1000 - 1800, // 30 minutes ago
    title: "This is a very insightful comment on the article.",
    previousParticipants: [
      { safeAvatar: "https://placehold.co/24x24" },
      { safeAvatar: "https://placehold.co/24x24" },
    ],
  },
};
