import parse, {parseQueryArgs} from './parse';

const prismaSchema = /* Prisma */ `
  enum Role {
    USER
    ADMIN
  }

  model Post {
    authorId  Int? // @Query
    content   String? //@Query
    id        Int     @default(autoincrement()) @id
    published Boolean @default(false) //                 @Query
    author    User?   @relation(fields: [authorId], references: [id])
  }
  
  model User {
    email String  @unique
    id    Int     @default(autoincrement()) @id
    name  String?
    posts Post[]
  }
`;

describe('DataModel', () => {
  it('returns name of models', async () => {
    const dataModel = await parse(prismaSchema);

    expect(dataModel.names).toEqual(['Post', 'User']);
  });

  it('returns detail model data that can be accessed with name', async () => {
    const dataModel = await parse(prismaSchema);

    const {Post, User} = dataModel.models;

    expect(Object.keys(Post)).toEqual([
      'name',
      'dbName',
      'fields',
      'primaryKey',
      'uniqueFields',
      'uniqueIndexes',
      'isGenerated',
    ]);

    expect(Object.keys(User)).toEqual([
      'name',
      'dbName',
      'fields',
      'primaryKey',
      'uniqueFields',
      'uniqueIndexes',
      'isGenerated',
    ]);
  });

  it('returns enums', async () => {
    const dataModel = await parse(prismaSchema);

    expect(dataModel.enums).toEqual({
      Role: [
        {name: 'USER', dbName: null},
        {name: 'ADMIN', dbName: null},
      ],
    });
  });

  it('should parse query args', async () => {
    const queryArgs = parseQueryArgs(prismaSchema);
    expect(queryArgs).toEqual([
      {field: 'authorId', type: 'Int', name: 'Post'},
      {field: 'content', type: 'String', name: 'Post'},
      {field: 'published', type: 'Boolean', name: 'Post'},
    ]);
  });
});
