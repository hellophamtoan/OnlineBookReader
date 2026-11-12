jest.mock('../src/config/db.config', () => ({ query: jest.fn() }));
const pool = require('../src/config/db.config');
const { getAuthors } = require('../src/controllers/author.controller');
const { getPublishers } = require('../src/controllers/publisher.controller');

const makeRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

describe('getAuthors / getPublishers', () => {
  beforeEach(() => jest.clearAllMocks());

  test('Tra ve danh sach tac gia active', async () => {
    pool.query.mockResolvedValueOnce([[{ id: 1, name: 'Nam Cao' }]]);
    const res = makeRes();
    await getAuthors({}, res);
    expect(pool.query.mock.calls[0][0]).toContain("status = 'active'");
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true, data: { items: [{ id: 1, name: 'Nam Cao' }] } }));
  });

  test('Tra ve danh sach NXB active', async () => {
    pool.query.mockResolvedValueOnce([[{ id: 2, name: 'NXB Tre' }]]);
    const res = makeRes();
    await getPublishers({}, res);
    expect(pool.query.mock.calls[0][0]).toContain("status = 'active'");
    expect(res.status).toHaveBeenCalledWith(200);
  });

  test('Loi DB tra 500', async () => {
    pool.query.mockRejectedValueOnce(new Error('db'));
    jest.spyOn(console, 'error').mockImplementation(() => {});
    const res = makeRes();
    await getAuthors({}, res);
    expect(res.status).toHaveBeenCalledWith(500);
  });
});
