const temporaryOrders = new Map();

export const saveTemporaryOrder = (userId, orderData) => {
  temporaryOrders.set(userId, orderData);
};

export const getTemporaryOrder = (userId) => {
  return temporaryOrders.get(userId);
};
