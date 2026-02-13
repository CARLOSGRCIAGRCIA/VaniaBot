declare global {
  var db: {
    data: {
      users: Record<string, any>;
      chats: Record<string, any>;
    };
  };
}

export {};
