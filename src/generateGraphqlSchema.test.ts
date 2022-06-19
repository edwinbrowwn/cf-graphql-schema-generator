import parse, {parseQueryArgs} from './parse';
import transpile from './transpile';
import generateGraphqlSchema, {description} from './generateGraphqlSchema';

jest.mock('./transpile');

describe('generateGraphqlSchema', () => {
  it.each([
    [
      {createCRUD: 'true', someThing: 'else'},
      {createQuery: 'true', createMutation: 'true', someThing: 'else'},
    ],
    [{createCRUD: 'not true'}, {createQuery: 'false', createMutation: 'false'}],
  ])(
    'calls transpiler with model and converted config',
    async (originalConfig, convertedConfig) => {
      const prismaSchema = /* Prisma */ `
        model Post {
          id    Int      @id  // @Query
          content1  Bytes
        }
      `;

      await generateGraphqlSchema(prismaSchema, originalConfig);

      const model = await parse(prismaSchema);
      const parsedQueryArgs = parseQueryArgs(prismaSchema);
      if (originalConfig.createCRUD === 'true') {
        expect(transpile).toHaveBeenCalledWith(
          model,
          convertedConfig,
          parsedQueryArgs,
        );
      } else {
        expect(transpile).toBeCalledWith(model, convertedConfig);
      }
    },
  );

  it('adds description', async () => {
    const prismaSchema = /* Prisma */ `
      model Post {
        id    Int      @id
        content1  Bytes
      }
    `;

    const result = await generateGraphqlSchema(prismaSchema, {});

    expect(result).toEqual(expect.stringContaining(description));
  });
});
