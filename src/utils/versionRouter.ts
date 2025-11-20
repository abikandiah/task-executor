import { Router } from "express";
import v1Router from "../routes/v1/index.js";

const getVersionRouter = (version: string): Router => {

	switch (version) {
		case 'v1':
			return v1Router;
		default:
			throw new Error(`Unsupported version: ${version}`);
	}
};

export default getVersionRouter;
