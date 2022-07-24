import logo from './logo.svg';
import './App.css';
import { withAuthenticator } from '@aws-amplify/ui-react';
import '@aws-amplify/ui-react/styles.css';

import {
	Button,
	Container,
	Text,
	Title,
	Modal,
	TextInput,
	Group,
	Card,
	ActionIcon
} from '@mantine/core';
import { useState, useRef, useEffect } from 'react';
import {  Trash } from 'tabler-icons-react';

import {
	MantineProvider
} from '@mantine/core';
import { createTodo,deleteTodo} from './graphql/mutations'
import { listTodos } from './graphql/queries'
import { API, graphqlOperation } from 'aws-amplify'


function App({ signOut, user })  {
	const [tasks, setTasks] = useState([]);
	const [opened, setOpened] = useState(false);

	const taskTitle = useRef('');
	const taskSummary = useRef('');


	async function deleteTask(index, id) {
    try {
		var clonedTasks = [...tasks];

    var cloneDelTask = [...tasks][index]

		clonedTasks.splice(index, 1);

		setTasks(clonedTasks);

      console.log({
        name: cloneDelTask.title,
        description: cloneDelTask.summary,
        createUser: user.username
      });
    await API.graphql(graphqlOperation(deleteTodo, {input: {
      id: id
    }}))
  } catch (err) {
    console.log('error creating todo:', err)
  }
  }

	





  async function addTodo() {
    try {
      if (!taskTitle.current.value) return
      console.log('ok')
      console.log(        {
        title: taskTitle.current.value,
        summary: taskSummary.current.value,
      })
      setTasks([
        ...tasks,
        {
          name: taskTitle.current.value,
          description: taskSummary.current.value,
        },
      ]);
      await API.graphql(graphqlOperation(createTodo, {input: {
        name: taskTitle.current.value,
        description: taskSummary.current.value,
        createUser: user.username
      }}))
    } catch (err) {
      console.log('error creating todo:', err)
    }
  }
  async function fetchTodos() {
    try {
      const ModelTodoFilterInput = {createUser:user.username}
      const todoData = await API.graphql(graphqlOperation(listTodos))
      const todos = todoData.data.listTodos.items
      setTasks(todos)
    } catch (err) { console.log('error fetching todos', err) }
  }

	useEffect(() => {
    fetchTodos();
	}, []);

	return (
			<MantineProvider
				theme={{defaultRadius: 'md' }}
				withGlobalStyles
				withNormalizeCSS>
				<div className='App'>
					<Modal
						opened={opened}
						size={'md'}
						title={'New Task'}
						withCloseButton={false}
						onClose={() => {
							setOpened(false);
						}}
						centered>
						<TextInput
							mt={'md'}
							ref={taskTitle}
							placeholder={'Task Title'}
							required
							label={'Title'}
						/>
						<TextInput
							ref={taskSummary}
							mt={'md'}
							placeholder={'Task Summary'}
							label={'Summary'}
						/>
						<Group mt={'md'} position={'apart'}>
							<Button
								onClick={() => {
									setOpened(false);
								}}
								variant={'subtle'}>
								Cancel
							</Button>
							<Button
								onClick={() => {
									addTodo();
									setOpened(false);
								}}>
								Create Task
							</Button>
						</Group>
					</Modal>
					<Container size={550} my={40}>
						<Group position={'apart'}>
							<Title
								sx={theme => ({
									fontFamily: `Greycliff CF, ${theme.fontFamily}`,
									fontWeight: 900,
								})}>
								Welcome {user.username}
							</Title>
              <Container></Container>
              <Button
              variant="outline" 
							onClick={signOut}
							
							mt={'md'}>
							Sign out
						</Button>
						</Group>
						{tasks.length > 0 ? (
							tasks.map((task, index) => {
								if (task.name) {
									return (
										<Card withBorder key={index} mt={'sm'}>
											<Group position={'apart'}>
												<Text weight={'bold'}>{task.name}</Text>
												<ActionIcon
													onClick={() => {
														deleteTask(index, task.id);
													}}
													color={'red'}
													variant={'transparent'}>
													<Trash />
												</ActionIcon>
											</Group>
											<Text color={'dimmed'} size={'md'} mt={'sm'}>
												{task.description
													? task.description
													: 'No summary was provided for this task'}
											</Text>
										</Card>
									);
								}
							})
						) : (
							<Text size={'lg'} mt={'md'} color={'dimmed'}>
								You have no tasks
							</Text>
						)}
						<Button
							onClick={() => {
								setOpened(true);
							}}
							fullWidth
							mt={'md'}>
							New Task
						</Button>

					</Container>
				</div>
			</MantineProvider>
	);
}

export default withAuthenticator(App);
