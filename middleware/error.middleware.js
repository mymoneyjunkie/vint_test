const errorMiddleware = (err, req, res, next) => {
	try {
		let error = { ...err };

		error.message = err.message;

		// console.log("error middleware error: ", err);

		if (err.statusCode === 401) {
			error = new Error(err.message);
			error.statusCode = 401;
		}

		else if (err.statusCode === 400) {
			error = new Error(err.message);
			error.statusCode = 400;
			error.data = [];
		}

		else if (err.name === 'ValidationError') {
			const message = err.message;
			error = new Error(message.split(', ').join(', '));
			error.oldInput = err.oldInput;
			error.statusCode = 400;
			error.data = [];
		}

		return res.status(error.statusCode || 500)
			.json({ 
				isSuccess: false, 
				message: error.message || 'Server Error', 
				oldInput: error.oldInput || '',
				...err
			});
	}

	catch (error) {
		console.log(error);
		next(error);
	}
}

export default errorMiddleware;