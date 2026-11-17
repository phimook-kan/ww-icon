import { Schema, model, models, Model, Types } from "mongoose";

export interface IUser {
  userId: string;               // ได้มาจาก API ภายนอก
  username: string;
  icons: Types.ObjectId[];      // array ของ iconId
}

const UserSchema = new Schema<IUser>(
  {
    userId: { type: String, required: true, unique: true },
    username: { type: String, required: true, trim: true },
    icons: [{ type: Schema.Types.ObjectId, ref: "Icon" }],
  },
  { versionKey: false }
);

export const User: Model<IUser> =
  (models.User as Model<IUser>) || model<IUser>("User", UserSchema);