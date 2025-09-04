// This is mock data for a tweet, based on the usage in row.mjs

export const mockTweet = {
  index: "tweet123",
  href: "https://twitter.com/user/status/12345",
  title: "This is a tweet title",
  metadata: {
    compliantTitle: "This is a tweet title",
    image: "https://placehold.co/600x338",
    ogDescription: "This is the content of the tweet. It can be a bit longer and include #hashtags and @mentions.",
    twitterAuthorAvatar: "https://placehold.co/48x48",
    twitterCreator: "@testuser",
  },
  timestamp: Date.now() / 1000 - 7200, // 2 hours ago
  identity: "0x1234567890123456789012345678901234567890",
  displayName: "testuser.eth",
  upvoters: ["0x1", "0x2", "0x3", "0x4", "0x5"],
  commentCount: 12,
};
