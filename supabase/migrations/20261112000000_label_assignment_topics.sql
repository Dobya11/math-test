alter table public.assignments
  drop constraint if exists assignments_topics_check;

update public.assignments a
set topics = array(
  select case topic
    when 'Тема 1' then 'Повторення матеріалу 1 класу'
    when 'Тема 2' then 'Додавання і віднімання в межах 20'
    when 'Тема 3' then 'Додавання двоцифрових чисел'
    when 'Тема 4' then 'Віднімання двоцифрових чисел'
    when 'Тема 5' then 'Числа, нумерація та порівняння'
    when 'Тема 6' then 'Вирази й порядок дій'
    when 'Тема 7' then 'Текстові задачі'
    when 'Тема 8' then 'Величини та вимірювання'
    when 'Тема 9' then 'Геометрія й периметр'
    when 'Тема 10' then 'Множення та ділення'
  end
  from unnest(a.topics) with ordinality as old_topics(topic, position)
  order by position
);

update public.generated_questions
set topic = case topic
  when 'Тема 1' then 'Повторення матеріалу 1 класу'
  when 'Тема 2' then 'Додавання і віднімання в межах 20'
  when 'Тема 3' then 'Додавання двоцифрових чисел'
  when 'Тема 4' then 'Віднімання двоцифрових чисел'
  when 'Тема 5' then 'Числа, нумерація та порівняння'
  when 'Тема 6' then 'Вирази й порядок дій'
  when 'Тема 7' then 'Текстові задачі'
  when 'Тема 8' then 'Величини та вимірювання'
  when 'Тема 9' then 'Геометрія й периметр'
  when 'Тема 10' then 'Множення та ділення'
end
where topic in (
  'Тема 1', 'Тема 2', 'Тема 3', 'Тема 4', 'Тема 5',
  'Тема 6', 'Тема 7', 'Тема 8', 'Тема 9', 'Тема 10'
);

alter table public.assignments
  add constraint assignments_topics_check check (
    cardinality(topics) between 1 and 10
    and topics <@ array[
      'Повторення матеріалу 1 класу',
      'Додавання і віднімання в межах 20',
      'Додавання двоцифрових чисел',
      'Віднімання двоцифрових чисел',
      'Числа, нумерація та порівняння',
      'Вирази й порядок дій',
      'Текстові задачі',
      'Величини та вимірювання',
      'Геометрія й периметр',
      'Множення та ділення'
    ]::text[]
    and public.has_unique_topics(topics)
  );
