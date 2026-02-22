class BadRequestError extends Error {
  constructor(message) {
    super(message)
    this.status = 400;
    this.code = 'BAD_REQUEST';
  }
}

// this will be used to send client errors for a BAD_REQUEST

// example:
//   if (Object.keys(req.query).length > 0) {
//     throw new BadRequestError('there are no queries for this route')
//   }
// with this I can seperate client errors from server errors in the error middleware
// this can be sent directly in the route, but for maintainability and scalability and consistency, I will centralize it through the error middleware

export default BadRequestError