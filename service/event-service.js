const fs = require("fs");
const path = require("path");
const ObjectId = require("mongodb").ObjectId;

const User = require("../models/user");
const ImageUser = require("../models/imageUser");
const ImageEvent = require("../models/imageEvent");
const Event = require("../models/event");
const ApiErrors = require("../exceptions/error-api");
const { userSharpPhoto } = require("./sharp-service");

const allEventsServise = async (params) => {
  /*const options = {
    page: 1,
    limit: 10,
    collation: {
      locale: "en",
    },
  };*/
  const options = {
    page: Number(params.page) || 1,
    limit: Number(params.limit) || 6,
    sort: { startDate: -1 },
  };
  const events = await Event.paginate(
    {
      type: { $regex: params.type || "" },
      city: { $regex: params.city || "" },
      name: { $regex: params.search || "",/* $options: "$ix"*/},
    },
    options
  );
  const arrOwnerUserEvents = [];
  const arrImgEventsId = [];
  events.docs.map((el) => {
    arrOwnerUserEvents.push(el.ownerUser);
    arrImgEventsId.push(el._id);
  });
  const uniqueId = Array.from(new Set(arrOwnerUserEvents));
  const uniqueUsers = await User.find({
    _id: uniqueId,
  });
  const uniqueImgUsers = await ImageUser.find(
    {
      user: uniqueId,
    },
    "-img_1000_1000 -field"
  );
  const ImgEvents = await ImageEvent.find(
    {
      event: arrImgEventsId,
    },
    "-img_1000_1000 -field"
  );
  return { events, uniqueUsers, uniqueImgUsers, ImgEvents };
};
const getEventServise = async (id) => {
  if (!id) {
    throw ApiErrors.BadRequest(`Ошибка при загрузке события!`);
  }
  const eventProfile = await Event.findById(id);
  const partyUsers = await User.find({
    _id: eventProfile.users,
  });
  const partyUsersImg = await ImageUser.find({
    user: eventProfile.users,
  });
  const eventImg = await ImageEvent.findOne({
    event: id,
  });
  const ownerUserData = await User.findOne({
    _id: eventProfile.ownerUser,
  });
  return { eventProfile, partyUsers, partyUsersImg, eventImg, ownerUserData };
};
const addUserEventServise = async (id, userId) => {
  if (!id) {
    throw ApiErrors.BadRequest(`Ошибка при загрузке события!`);
  }
  const result = await Event.findById(id);
  result.users.push(userId);
  result.amountMaximum = result.amountMaximum - 1;
  await result.save();
  return result;
};
const delUserEventServise = async (id, userId) => {
  if (!id) {
    throw ApiErrors.BadRequest(`Ошибка при загрузке события!`);
  }
  const result = await Event.findById(id);
  result.users = result.users.find((id) => id !== userId);
  result.amountMaximum = result.amountMaximum + 1;
  await result.save();
  return result;
};
const createEventServise = async (id, data) => {
  if (!data) {
    throw ApiErrors.BadRequest(`Ошибка при создания события!`);
  }
  const eventData = await Event.create({
    name: data.name,
    about: data.about,
    startDate: data.startDate,
    endDate: data.endDate,
    amountMaximum: data.amountMaximum,
    type: data.type,
    ownerUser: id,
    city: data.city,
    address: data.address,
  });
  return eventData;
};
const deleteEventServise = async (id) => {
  if (!id) {
    throw ApiErrors.BadRequest(`Ошибка при удалении события!`);
  }
  const resDeleteEvent = await Event.deleteOne({ _id: id });
  return resDeleteEvent;
};
const createEventImgServise = async (fileData, id) => {
  if (!id) {
    throw ApiErrors.BadRequest(`Ошибка при загрузки файла события!`);
  }
  const o_id = new ObjectId(id);
  if (!fileData) {
    throw ApiErrors.BadRequest(`Ошибка при загрузки файла события!`);
  }
  await userSharpPhoto(fileData);
  fs.unlink(path.join(__dirname, "../uploads", fileData.filename), (err) => {
    if (err) console.log(err);
    else {
      console.log("\nDeleted file:" + fileData.filename);
    }
  });
  const imgEvent = await ImageEvent.findOne({ event: o_id });
  if (imgEvent) {
    imgEvent.img_200_200 = {
      data: fs.readFileSync(
        path.join(__dirname, "../uploads", "/avatar_thumb.jpg")
      ),
      contentType: "jpg",
      originalname: fileData.originalname,
    };
    imgEvent.img_1000_1000 = {
      data: fs.readFileSync(
        path.join(__dirname, "../uploads", "/avatar_preview.jpg")
      ),
      contentType: "jpg",
      originalname: fileData.originalname,
    };
    return imgEvent.save();
  }
  const createNewEventImg = await ImageEvent.create({
    event: o_id,
    img_200_200: {
      data: fs.readFileSync(
        path.join(__dirname, "../uploads", "/avatar_thumb.jpg")
      ),
      contentType: "jpg",
      originalname: fileData.originalname,
    },
    img_1000_1000: {
      data: fs.readFileSync(
        path.join(__dirname, "../uploads", "/avatar_preview.jpg")
      ),
      contentType: "jpg",
      originalname: fileData.originalname,
    },
  });
  return {
    createNewEventImg,
  };
};
const editEventDataServise = async (id, data) => {
  const candidate = await Event.findById(id, "-password -field");
  if (!candidate) {
    throw ApiErrors.BadRequest(`Событие ${id} не найдено!`);
  }
  const accessEditEventData = await Event.findByIdAndUpdate(
    id,
    {
      startDate: data.startDate,
      endDate: data.endDate,
      about: data.about,
      address: data.address,
      city: data.city,
      name: data.name,
      amountMaximum: data.amountMaximum,
      type: data.type,
    },
    { new: true }
  );
  return accessEditEventData;
};

module.exports = {
  allEventsServise,
  getEventServise,
  addUserEventServise,
  delUserEventServise,
  createEventServise,
  deleteEventServise,
  createEventImgServise,
  editEventDataServise,
};
